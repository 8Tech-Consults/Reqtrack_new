import { GraphQLError } from 'graphql';
import { db } from '../../config/config.js';
import saveData from '../../utils/db/saveData.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';
import { askHelpAssistant, findRelevantArticles } from '../../services/helpAssistantService.js';

const MANAGE_PERMISSION = 'can_manage_help_centre';

const requireUser = (context) => {
  const user = context?.req?.user;
  if (!user?.id) {
    throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return user;
};

const requireManager = (context) => {
  const user = requireUser(context);
  checkPermission(user.permissions, MANAGE_PERMISSION, "You don't have permission to manage the Help Centre.");
  return user;
};

const badInput = (message) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

const optionalText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const mapArticle = (row) => ({
  id: String(row.id),
  categoryId: row.category_id != null ? String(row.category_id) : null,
  categoryName: row.category_name || null,
  question: row.question,
  answer: row.answer,
  keywords: row.keywords || null,
  published: Boolean(row.published),
  sortOrder: Number(row.sort_order || 0),
  viewCount: Number(row.view_count || 0),
  helpfulYes: Number(row.helpful_yes || 0),
  helpfulNo: Number(row.helpful_no || 0),
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
});

const ARTICLE_SELECT = `
  SELECT a.*, c.name AS category_name
  FROM help_articles a
  LEFT JOIN help_categories c ON c.id = a.category_id AND c.deleted = 0`;

const fetchArticle = async (id, { includeUnpublished = false } = {}) => {
  const [[row]] = await db.execute(
    `${ARTICLE_SELECT}
     WHERE a.id = ? AND a.deleted = 0 ${includeUnpublished ? '' : 'AND a.published = 1'}
     LIMIT 1`,
    [id]
  );
  return row ? mapArticle(row) : null;
};

const helpCentreResolvers = {
  Query: {
    helpCategories: async (_parent, _args, context) => {
      const user = requireUser(context);
      const canManage = hasPermission(user.permissions, MANAGE_PERMISSION);
      const [rows] = await db.execute(
        `SELECT c.id, c.name, c.description, c.icon, c.sort_order,
                COUNT(a.id) AS article_count
         FROM help_categories c
         LEFT JOIN help_articles a
           ON a.category_id = c.id AND a.deleted = 0 ${canManage ? '' : 'AND a.published = 1'}
         WHERE c.deleted = 0
         GROUP BY c.id, c.name, c.description, c.icon, c.sort_order
         ORDER BY c.sort_order ASC, c.name ASC`
      );
      return rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        description: row.description || null,
        icon: row.icon || null,
        sortOrder: Number(row.sort_order || 0),
        articleCount: Number(row.article_count || 0),
      }));
    },

    helpArticles: async (_parent, { search, categoryId, includeUnpublished }, context) => {
      const user = requireUser(context);
      const showUnpublished = Boolean(includeUnpublished) && hasPermission(user.permissions, MANAGE_PERMISSION);
      const term = String(search || '').trim();

      if (term && !showUnpublished) {
        // Same ranking the AI assistant uses, so search and assistant agree.
        const ranked = await findRelevantArticles(term, 25);
        if (!ranked.length) return [];
        const ids = ranked.map((row) => row.id);
        const [rows] = await db.execute(
          `${ARTICLE_SELECT}
           WHERE a.deleted = 0 AND a.published = 1 AND a.id IN (${ids.map(() => '?').join(', ')})
           ${categoryId ? 'AND a.category_id = ?' : ''}`,
          categoryId ? [...ids, categoryId] : ids
        );
        const byId = new Map(rows.map((row) => [String(row.id), row]));
        return ids.map((id) => byId.get(String(id))).filter(Boolean).map(mapArticle);
      }

      const where = ['a.deleted = 0'];
      const values = [];
      if (!showUnpublished) where.push('a.published = 1');
      if (categoryId) {
        where.push('a.category_id = ?');
        values.push(categoryId);
      }
      if (term) {
        where.push('(a.question LIKE ? OR a.answer LIKE ? OR a.keywords LIKE ?)');
        values.push(`%${term}%`, `%${term}%`, `%${term}%`);
      }
      const [rows] = await db.execute(
        `${ARTICLE_SELECT}
         WHERE ${where.join(' AND ')}
         ORDER BY c.sort_order ASC, a.sort_order ASC, a.question ASC`,
        values
      );
      return rows.map(mapArticle);
    },

    helpArticle: async (_parent, { id }, context) => {
      const user = requireUser(context);
      const includeUnpublished = hasPermission(user.permissions, MANAGE_PERMISSION);
      const article = await fetchArticle(id, { includeUnpublished });
      if (article) {
        await db.execute(`UPDATE help_articles SET view_count = view_count + 1 WHERE id = ?`, [id]);
        article.viewCount += 1;
      }
      return article;
    },

    helpAssistantLogs: async (_parent, { limit, filter }, context) => {
      requireManager(context);
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const where = [];
      if (filter === 'unhelpful') where.push('l.helpful = 0');
      if (filter === 'not_covered') where.push("l.source IN ('not_covered', 'fallback')");
      const [rows] = await db.execute(
        `SELECT l.id, l.question, l.answer, l.source, l.helpful, l.created_at, u.name AS user_name
         FROM help_assistant_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT ${safeLimit}`
      );
      return rows.map((row) => ({
        id: String(row.id),
        userName: row.user_name || null,
        question: row.question,
        answer: row.answer || null,
        source: row.source,
        helpful: row.helpful === null || row.helpful === undefined ? null : Boolean(row.helpful),
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },
  },

  Mutation: {
    askHelpAssistant: async (_parent, { question, history }, context) => {
      const user = requireUser(context);
      return askHelpAssistant({ userId: user.id, question, history });
    },

    rateAssistantAnswer: async (_parent, { logId, helpful }, context) => {
      const user = requireUser(context);
      // Users can only rate answers they were given.
      const [result] = await db.execute(
        `UPDATE help_assistant_logs SET helpful = ? WHERE id = ? AND user_id = ?`,
        [helpful ? 1 : 0, logId, user.id]
      );
      return result.affectedRows > 0;
    },

    rateHelpArticle: async (_parent, { id, helpful }, context) => {
      requireUser(context);
      const column = helpful ? 'helpful_yes' : 'helpful_no';
      await db.execute(
        `UPDATE help_articles SET ${column} = ${column} + 1 WHERE id = ? AND deleted = 0 AND published = 1`,
        [id]
      );
      return fetchArticle(id);
    },

    saveHelpCategory: async (_parent, { input }, context) => {
      requireManager(context);
      const id = optionalText(input?.id);
      const name = String(input?.name || '').trim();
      if (!name) throw badInput('Category name is required.');

      const [[duplicate]] = await db.execute(
        `SELECT id FROM help_categories WHERE deleted = 0 AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1`,
        [name, id || 0]
      );
      if (duplicate) throw badInput('A category with this name already exists.');

      let sortOrder = Number.isFinite(Number(input?.sortOrder)) ? Number(input.sortOrder) : null;
      if (sortOrder === null && !id) {
        const [[{ nextSort }]] = await db.execute(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextSort FROM help_categories WHERE deleted = 0`
        );
        sortOrder = Number(nextSort);
      }

      const data = {
        name,
        description: optionalText(input?.description),
        icon: optionalText(input?.icon),
        ...(sortOrder !== null ? { sort_order: sortOrder } : {}),
      };
      const savedId = await saveData({ table: 'help_categories', id, data });
      return { success: true, message: id ? 'Category updated.' : 'Category created.', id: String(savedId) };
    },

    deleteHelpCategory: async (_parent, { id }, context) => {
      requireManager(context);
      const [[{ articleCount }]] = await db.execute(
        `SELECT COUNT(*) AS articleCount FROM help_articles WHERE category_id = ? AND deleted = 0`,
        [id]
      );
      if (Number(articleCount) > 0) {
        throw badInput('Move or delete the articles in this category first.');
      }
      await db.execute(`UPDATE help_categories SET deleted = 1 WHERE id = ?`, [id]);
      return { success: true, message: 'Category deleted.', id: String(id) };
    },

    saveHelpArticle: async (_parent, { input }, context) => {
      const user = requireManager(context);
      const id = optionalText(input?.id);
      const question = String(input?.question || '').trim();
      const answer = String(input?.answer || '').trim();
      const categoryId = optionalText(input?.categoryId);

      if (!question) throw badInput('Question is required.');
      if (question.length > 255) throw badInput('Question must be 255 characters or fewer.');
      if (!answer) throw badInput('Answer is required.');

      if (categoryId) {
        const [[category]] = await db.execute(
          `SELECT id FROM help_categories WHERE id = ? AND deleted = 0 LIMIT 1`,
          [categoryId]
        );
        if (!category) throw badInput('Category not found.');
      }

      const [[duplicate]] = await db.execute(
        `SELECT id, deleted FROM help_articles WHERE LOWER(question) = LOWER(?) AND id <> ? LIMIT 1`,
        [question, id || 0]
      );
      if (duplicate && !duplicate.deleted) throw badInput('An article with this question already exists.');
      if (duplicate && duplicate.deleted) {
        // The question column is unique; free the name held by a deleted article.
        await db.execute(`UPDATE help_articles SET question = CONCAT(question, ' [deleted ', id, ']') WHERE id = ?`, [
          duplicate.id,
        ]);
      }

      const data = {
        category_id: categoryId,
        question,
        answer,
        keywords: optionalText(input?.keywords),
        published: input?.published === false ? 0 : 1,
        ...(Number.isFinite(Number(input?.sortOrder)) ? { sort_order: Number(input.sortOrder) } : {}),
        updated_by: user.id,
        ...(id ? {} : { created_by: user.id }),
      };
      const savedId = await saveData({ table: 'help_articles', id, data });
      return { success: true, message: id ? 'Article updated.' : 'Article created.', id: String(savedId) };
    },

    deleteHelpArticle: async (_parent, { id }, context) => {
      const user = requireManager(context);
      await db.execute(`UPDATE help_articles SET deleted = 1, updated_by = ? WHERE id = ?`, [user.id, id]);
      return { success: true, message: 'Article deleted.', id: String(id) };
    },

    setHelpArticlePublished: async (_parent, { id, published }, context) => {
      const user = requireManager(context);
      const [result] = await db.execute(
        `UPDATE help_articles SET published = ?, updated_by = ? WHERE id = ? AND deleted = 0`,
        [published ? 1 : 0, user.id, id]
      );
      if (!result.affectedRows) throw new GraphQLError('Article not found.', { extensions: { code: 'NOT_FOUND' } });
      return { success: true, message: published ? 'Article published.' : 'Article unpublished.', id: String(id) };
    },
  },
};

export default helpCentreResolvers;
