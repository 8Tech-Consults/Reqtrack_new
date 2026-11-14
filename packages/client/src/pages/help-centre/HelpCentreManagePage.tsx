import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Eye, EyeOff, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Container } from '@/components/container';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemo8Layout } from '@/layouts/demo8';
import { HelpText } from '@/components/help-assistant/HelpText';
import {
  DELETE_HELP_ARTICLE,
  DELETE_HELP_CATEGORY,
  GET_HELP_ARTICLES,
  GET_HELP_ASSISTANT_LOGS,
  GET_HELP_CATEGORIES,
  HelpArticle,
  HelpAssistantLog,
  HelpCategory,
  HelpCentreMutationResponse,
  SAVE_HELP_ARTICLE,
  SAVE_HELP_CATEGORY,
  SET_HELP_ARTICLE_PUBLISHED
} from '@/gql/helpCentre';

type Tab = 'articles' | 'categories' | 'questions';

type ArticleDraft = {
  id: string | null;
  categoryId: string;
  question: string;
  answer: string;
  keywords: string;
  published: boolean;
};

type CategoryDraft = { id: string | null; name: string; description: string; sortOrder: string };

const EMPTY_ARTICLE: ArticleDraft = { id: null, categoryId: '', question: '', answer: '', keywords: '', published: true };
const EMPTY_CATEGORY: CategoryDraft = { id: null, name: '', description: '', sortOrder: '' };

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const SOURCE_LABEL: Record<string, { label: string; tone: string }> = {
  model: { label: 'Answered', tone: 'bg-emerald-50 text-emerald-700' },
  fallback: { label: 'Articles listed (no AI)', tone: 'bg-slate-100 text-slate-600' },
  not_covered: { label: 'Not covered', tone: 'bg-amber-50 text-amber-700' }
};

const HelpCentreManagePage = () => {
  const { setPageActions } = useDemo8Layout();
  const [tab, setTab] = useState<Tab>('articles');
  const [articleFilter, setArticleFilter] = useState('');
  const [articleDraft, setArticleDraft] = useState<ArticleDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'unhelpful' | 'not_covered'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const refetchAll = [{ query: GET_HELP_CATEGORIES }, { query: GET_HELP_ARTICLES, variables: { includeUnpublished: true } }];

  const { data: categoryData } = useQuery<{ helpCategories: HelpCategory[] }>(GET_HELP_CATEGORIES);
  const { data: articleData, loading: loadingArticles } = useQuery<{ helpArticles: HelpArticle[] }>(GET_HELP_ARTICLES, {
    variables: { includeUnpublished: true }
  });
  const { data: logData, loading: loadingLogs } = useQuery<{ helpAssistantLogs: HelpAssistantLog[] }>(
    GET_HELP_ASSISTANT_LOGS,
    { variables: { limit: 200, filter: logFilter }, skip: tab !== 'questions', fetchPolicy: 'network-only' }
  );

  const mutationOptions = { refetchQueries: refetchAll, awaitRefetchQueries: true };
  const [saveArticle, { loading: savingArticle }] = useMutation<{ saveHelpArticle: HelpCentreMutationResponse }>(
    SAVE_HELP_ARTICLE,
    mutationOptions
  );
  const [deleteArticle] = useMutation<{ deleteHelpArticle: HelpCentreMutationResponse }>(DELETE_HELP_ARTICLE, mutationOptions);
  const [setPublished] = useMutation<{ setHelpArticlePublished: HelpCentreMutationResponse }>(
    SET_HELP_ARTICLE_PUBLISHED,
    mutationOptions
  );
  const [saveCategory, { loading: savingCategory }] = useMutation<{ saveHelpCategory: HelpCentreMutationResponse }>(
    SAVE_HELP_CATEGORY,
    mutationOptions
  );
  const [deleteCategory] = useMutation<{ deleteHelpCategory: HelpCentreMutationResponse }>(DELETE_HELP_CATEGORY, mutationOptions);

  const categories = categoryData?.helpCategories || [];
  const filterText = articleFilter.trim().toLowerCase();
  const articles = (articleData?.helpArticles || []).filter(
    (article) =>
      !filterText ||
      article.question.toLowerCase().includes(filterText) ||
      (article.categoryName || '').toLowerCase().includes(filterText)
  );

  const openNew = useCallback(() => {
    if (tab === 'categories') setCategoryDraft({ ...EMPTY_CATEGORY });
    else setArticleDraft({ ...EMPTY_ARTICLE });
  }, [tab]);

  useEffect(() => {
    setPageActions(
      tab === 'questions'
        ? []
        : [{ label: tab === 'categories' ? 'New Category' : 'New Article', onClick: openNew, icon: 'plus' }]
    );
    return () => setPageActions([]);
  }, [tab, openNew, setPageActions]);

  const handleSaveArticle = async (event: FormEvent) => {
    event.preventDefault();
    if (!articleDraft) return;
    try {
      const response = await saveArticle({
        variables: {
          input: {
            id: articleDraft.id,
            categoryId: articleDraft.categoryId || null,
            question: articleDraft.question,
            answer: articleDraft.answer,
            keywords: articleDraft.keywords,
            published: articleDraft.published
          }
        }
      });
      toast.success(response.data?.saveHelpArticle.message || 'Article saved.');
      setArticleDraft(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to save the article.'));
    }
  };

  const handleSaveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryDraft) return;
    try {
      const response = await saveCategory({
        variables: {
          input: {
            id: categoryDraft.id,
            name: categoryDraft.name,
            description: categoryDraft.description,
            sortOrder: categoryDraft.sortOrder === '' ? null : Number(categoryDraft.sortOrder)
          }
        }
      });
      toast.success(response.data?.saveHelpCategory.message || 'Category saved.');
      setCategoryDraft(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to save the category.'));
    }
  };

  const handleDeleteArticle = async (article: HelpArticle) => {
    if (!window.confirm(`Delete "${article.question}"? It will no longer appear in the Help Centre or be used by the assistant.`)) return;
    try {
      await deleteArticle({ variables: { id: article.id } });
      toast.success('Article deleted.');
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to delete the article.'));
    }
  };

  const handleTogglePublished = async (article: HelpArticle) => {
    try {
      const response = await setPublished({ variables: { id: article.id, published: !article.published } });
      toast.success(response.data?.setHelpArticlePublished.message || 'Updated.');
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to update the article.'));
    }
  };

  const handleDeleteCategory = async (category: HelpCategory) => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    try {
      await deleteCategory({ variables: { id: category.id } });
      toast.success('Category deleted.');
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to delete the category.'));
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'articles', label: 'Articles' },
    { id: 'categories', label: 'Categories' },
    { id: 'questions', label: 'Assistant questions' }
  ];

  return (
    <Container>
      <div className="space-y-4 py-4 sm:py-5 lg:py-6">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={clsx(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium',
                tab === item.id ? 'border-[#2aaed3] text-[#2aaed3]' : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'articles' && (
          <div className="space-y-3">
            <input
              type="search"
              value={articleFilter}
              onChange={(event) => setArticleFilter(event.target.value)}
              placeholder="Filter by question or category"
              className="input h-10 w-full max-w-md"
              aria-label="Filter articles"
            />
            {loadingArticles && !articles.length ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : !articles.length ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No articles yet. Click <strong>New Article</strong> to add one.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {articles.map((article) => (
                  <div key={article.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{article.question}</p>
                        {!article.published && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Unpublished</span>
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{article.categoryName || 'No category'}</span>
                        <span>{article.viewCount} views</span>
                        <span className="inline-flex items-center gap-1"><ThumbsUp size={11} /> {article.helpfulYes}</span>
                        <span className="inline-flex items-center gap-1"><ThumbsDown size={11} /> {article.helpfulNo}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-clear"
                        onClick={() => handleTogglePublished(article)}
                        title={article.published ? 'Unpublish' : 'Publish'}
                        aria-label={article.published ? 'Unpublish article' : 'Publish article'}
                      >
                        {article.published ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-clear"
                        onClick={() =>
                          setArticleDraft({
                            id: article.id,
                            categoryId: article.categoryId || '',
                            question: article.question,
                            answer: article.answer,
                            keywords: article.keywords || '',
                            published: article.published
                          })
                        }
                        title="Edit"
                        aria-label="Edit article"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-clear text-rose-500"
                        onClick={() => handleDeleteArticle(article)}
                        title="Delete"
                        aria-label="Delete article"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'categories' && (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!categories.length && <p className="p-8 text-center text-sm text-slate-500">No categories yet.</p>}
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-500">
                    {category.articleCount} article{category.articleCount === 1 ? '' : 's'}
                    {category.description ? ` · ${category.description}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-clear"
                    onClick={() =>
                      setCategoryDraft({
                        id: category.id,
                        name: category.name,
                        description: category.description || '',
                        sortOrder: String(category.sortOrder)
                      })
                    }
                    aria-label="Edit category"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-clear text-rose-500"
                    onClick={() => handleDeleteCategory(category)}
                    aria-label="Delete category"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'questions' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Questions people asked the assistant. Use the ones that weren&apos;t covered or were rated unhelpful to
              write new articles.
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['not_covered', 'Not covered / no AI'],
                ['unhelpful', 'Rated unhelpful']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLogFilter(value)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    logFilter === value ? 'border-[#2aaed3] bg-[#2aaed3] text-white' : 'border-slate-200 text-slate-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {loadingLogs ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : !logData?.helpAssistantLogs.length ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No questions yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {logData.helpAssistantLogs.map((log) => {
                  const badge = SOURCE_LABEL[log.source] || SOURCE_LABEL.fallback;
                  const expanded = expandedLogId === log.id;
                  return (
                    <div key={log.id} className="px-4 py-3">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => setExpandedLogId(expanded ? null : log.id)}
                        aria-expanded={expanded}
                      >
                        <span className="text-sm text-slate-900">{log.question}</span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                          <span className={clsx('rounded-full px-2 py-0.5 font-medium', badge.tone)}>{badge.label}</span>
                          {log.helpful === true && <ThumbsUp size={12} className="text-emerald-600" />}
                          {log.helpful === false && <ThumbsDown size={12} className="text-rose-600" />}
                          <span>{log.userName || 'Unknown user'}</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </span>
                      </button>
                      {expanded && log.answer && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-3">
                          <HelpText text={log.answer} className="text-xs" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!articleDraft} onOpenChange={(open) => !open && setArticleDraft(null)}>
        <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-[620px]">
          <div className="border-b bg-slate-50/50 p-6">
            <SheetHeader>
              <SheetTitle>{articleDraft?.id ? 'Edit article' : 'New article'}</SheetTitle>
              <SheetDescription>
                Published articles appear in the Help Centre and are the only source the AI assistant answers from.
              </SheetDescription>
            </SheetHeader>
          </div>
          {articleDraft && (
            <form onSubmit={handleSaveArticle} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                <label className="block space-y-1.5">
                  <span className="form-label text-slate-900">Category</span>
                  <select
                    className="select select-bordered w-full"
                    value={articleDraft.categoryId}
                    onChange={(event) => setArticleDraft({ ...articleDraft, categoryId: event.target.value })}
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="form-label text-slate-900">Question</span>
                  <input
                    className="input input-bordered w-full"
                    value={articleDraft.question}
                    maxLength={255}
                    required
                    placeholder="e.g. How do I submit a requisition?"
                    onChange={(event) => setArticleDraft({ ...articleDraft, question: event.target.value })}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="form-label text-slate-900">Answer</span>
                  <textarea
                    className="textarea min-h-56 w-full"
                    value={articleDraft.answer}
                    required
                    onChange={(event) => setArticleDraft({ ...articleDraft, answer: event.target.value })}
                  />
                  <span className="block text-xs text-slate-500">
                    Start lines with &quot;1.&quot; for steps or &quot;-&quot; for bullets. Wrap button names in **double asterisks** to bold them.
                  </span>
                </label>
                {articleDraft.answer.trim() && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Preview</p>
                    <HelpText text={articleDraft.answer} />
                  </div>
                )}
                <label className="block space-y-1.5">
                  <span className="form-label text-slate-900">Search keywords</span>
                  <input
                    className="input input-bordered w-full"
                    value={articleDraft.keywords}
                    maxLength={500}
                    placeholder="Other words people might use, e.g. raise request funds"
                    onChange={(event) => setArticleDraft({ ...articleDraft, keywords: event.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={articleDraft.published}
                    onChange={(event) => setArticleDraft({ ...articleDraft, published: event.target.checked })}
                  />
                  Published
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t p-6">
                <button type="button" className="btn btn-light" onClick={() => setArticleDraft(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingArticle}>
                  {savingArticle ? 'Saving…' : 'Save article'}
                </button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!categoryDraft} onOpenChange={(open) => !open && setCategoryDraft(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{categoryDraft?.id ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogDescription>Categories group articles on the Help Centre page.</DialogDescription>
          </DialogHeader>
          {categoryDraft && (
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="form-label text-slate-900">Name</span>
                <input
                  className="input input-bordered w-full"
                  value={categoryDraft.name}
                  maxLength={120}
                  required
                  onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="form-label text-slate-900">Description</span>
                <input
                  className="input input-bordered w-full"
                  value={categoryDraft.description}
                  maxLength={255}
                  onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="form-label text-slate-900">Display order</span>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={categoryDraft.sortOrder}
                  placeholder="Added at the end if left blank"
                  onChange={(event) => setCategoryDraft({ ...categoryDraft, sortOrder: event.target.value })}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-light" onClick={() => setCategoryDraft(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingCategory}>
                  {savingCategory ? 'Saving…' : 'Save category'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default HelpCentreManagePage;
