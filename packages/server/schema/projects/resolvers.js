import { GraphQLError } from "graphql";
import { db } from "../../config/config.js";
import hasPermission from "../../helpers/hasPermission.js";
import checkPermission from "../../helpers/checkPermission.js";


const ensureProjectWriteAccess = (context, message) => {
  const userPermissions = context?.req?.user?.permissions;
  const canWriteProjects =
    hasPermission(userPermissions, "can_manage_projects") ||
    hasPermission(userPermissions, "can_create_projects") ||
    hasPermission(userPermissions, "can_edit_projects") ||
    hasPermission(userPermissions, "can_manage_templates");

  if (!canWriteProjects) {
    checkPermission(userPermissions, "can_manage_projects", message);
  }
};

const ensureStaffAssignAccess = (context, message) => {
  const userPermissions = context?.req?.user?.permissions;
  const canAssignStaff =
    hasPermission(userPermissions, "can_manage_projects") ||
    hasPermission(userPermissions, "can_manage_users");

  if (!canAssignStaff) {
    checkPermission(userPermissions, "can_manage_projects", message);
  }
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeName = (value, fallbackLabel) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new GraphQLError(`${fallbackLabel} name is required.`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return normalized;
};

const getExistingRowsByParent = async (connection, table, parentColumn, parentIds) => {
  if (!parentIds.length) {
    return [];
  }

  const placeholders = parentIds.map(() => "?").join(", ");
  const [rows] = await connection.execute(
    `SELECT * FROM ${table} WHERE ${parentColumn} IN (${placeholders})`,
    parentIds,
  );

  return rows;
};

const ensureTemplateExists = async (templateId) => {
  const [[template]] = await db.execute(
    `SELECT id FROM project_templates WHERE id = ? AND deleted = 0 LIMIT 1`,
    [templateId],
  );

  if (!template) {
    throw new GraphQLError("Template not found.", {
      extensions: { code: "NOT_FOUND" },
    });
  }
};

const syncStructureLevel = async ({
  connection,
  table,
  parentColumn,
  parentId,
  items,
  itemLabel,
}) => {
  const [existingRows] = await connection.execute(
    `SELECT * FROM ${table} WHERE ${parentColumn} = ?`,
    [parentId],
  );

  const existingById = new Map(existingRows.map((row) => [String(row.id), row]));
  const keptIds = [];
  const idMap = new Map();
  const createdIds = [];

  for (const [index, item] of items.entries()) {
    const rawId = item?.id ? String(item.id) : null;
    const existing = rawId ? existingById.get(rawId) : null;
    const name = normalizeName(item?.name, itemLabel);
    const sortOrder = Number.isFinite(Number(item?.sortOrder))
      ? Number(item.sortOrder)
      : index;

    let resolvedId = rawId;

    if (existing) {
      await connection.execute(
        `UPDATE ${table}
         SET name = ?, sort_order = ?, deleted = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, sortOrder, resolvedId],
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO ${table} (${parentColumn}, name, sort_order, deleted)
         VALUES (?, ?, ?, 0)`,
        [parentId, name, sortOrder],
      );
      resolvedId = String(insertResult.insertId);
      createdIds.push(resolvedId);
    }

    keptIds.push(resolvedId);
    if (rawId) {
      idMap.set(rawId, resolvedId);
    }
  }

  for (const row of existingRows) {
    const rowId = String(row.id);
    if (!keptIds.includes(rowId) && Number(row.deleted) === 0) {
      await connection.execute(
        `UPDATE ${table}
         SET deleted = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [rowId],
      );
    }
  }

  return { keptIds, idMap, createdIds };
};

const mapBudgetInputRow = (row) => ({
  id: String(row.id),
  projectYearId: String(row.project_year_id),
  budgetLineId: String(row.budget_line_id),
  quantity: toNumber(row.quantity, 1),
  frequency: toNumber(row.frequency, 1),
  unitCost: toNumber(row.unit_cost, 0),
  units: toNumber(row.units, 1),
  plannedAmount: toNumber(row.planned_amount, 0),
  actualAmount: toNumber(row.actual_amount, 0),
  notes: row.notes || null,
});

const mapProjectYear = (row) => ({
  id: String(row.id),
  templateId: String(row.template_id),
  financialYear: Number(row.financial_year),
  status: row.status,
  startDate: row.start_date || null,
  endDate: row.end_date || null,
  assignedStaffId: row.assigned_staff_id || null,
});

const getProjectTemplateIds = (templates) => templates.map((template) => String(template.id));

const resolveProjectViewScope = (user) => {
  const userPermissions = user?.permissions || [];

  const canManageProjects = hasPermission(userPermissions, "can_manage_projects");
  const canViewProjects = hasPermission(userPermissions, "can_view_projects");
  const canViewOwnProjects = hasPermission(userPermissions, "can_view_own_projects");

  if (!canManageProjects && !canViewProjects && !canViewOwnProjects) {
    checkPermission(userPermissions, "can_view_projects", "You don't have permission to view projects.");
  }

  return {
    onlyAssignedToUserId:
      !canManageProjects && !canViewProjects && canViewOwnProjects
        ? user?.id || null
        : null,
  };
};

export const fetchProjectTemplates = async ({ onlyAssignedToUserId = null } = {}) => {
  try {

    let yearsRows = [];
    let templates = [];

    if (onlyAssignedToUserId) {
      const [ownYearsRows] = await db.execute(
        `SELECT id, template_id, financial_year, status, start_date, end_date, assigned_staff_id
         FROM project_years
         WHERE deleted = 0 AND assigned_staff_id = ?
         ORDER BY financial_year DESC`,
        [onlyAssignedToUserId],
      );

      if (!ownYearsRows.length) {
        return [];
      }

      yearsRows = ownYearsRows;

      const templateIds = Array.from(new Set(ownYearsRows.map((row) => String(row.template_id))));
      const placeholders = templateIds.map(() => "?").join(", ");
      const [ownTemplates] = await db.execute(
        `SELECT id, name, description, status
         FROM project_templates
         WHERE deleted = 0 AND id IN (${placeholders})
         ORDER BY updated_at DESC`,
        templateIds,
      );

      templates = ownTemplates;
    } else {
      const [allTemplates] = await db.execute(
        `SELECT id, name, description, status
         FROM project_templates
         WHERE deleted = 0
         ORDER BY updated_at DESC`,
      );
      templates = allTemplates;
    }

    if (!templates.length) {
      return [];
    }

    const templateIds = getProjectTemplateIds(templates);
    const placeholders = templateIds.map(() => "?").join(", ");

    if (!onlyAssignedToUserId) {
      const [allYearsRows] = await db.execute(
        `SELECT id, template_id, financial_year, status, start_date, end_date, assigned_staff_id
         FROM project_years
         WHERE deleted = 0 AND template_id IN (${placeholders})
         ORDER BY financial_year DESC`,
        templateIds,
      );
      yearsRows = allYearsRows;
    }

    const [outcomesRows] = await db.execute(
      `SELECT id, template_id, name, sort_order
       FROM template_outcomes
       WHERE deleted = 0 AND template_id IN (${placeholders})
       ORDER BY sort_order ASC, created_at ASC`,
      templateIds,
    );

    const outcomeIds = outcomesRows.map((row) => String(row.id));

    let outputsRows = [];
    let activitiesRows = [];
    let budgetLinesRows = [];

    if (outcomeIds.length) {
      const outcomePlaceholders = outcomeIds.map(() => "?").join(", ");

      [outputsRows] = await db.execute(
        `SELECT id, outcome_id, name, sort_order
         FROM template_outputs
         WHERE deleted = 0 AND outcome_id IN (${outcomePlaceholders})
         ORDER BY sort_order ASC, created_at ASC`,
        outcomeIds,
      );

      const outputIds = outputsRows.map((row) => String(row.id));
      if (outputIds.length) {
        const outputPlaceholders = outputIds.map(() => "?").join(", ");

        [activitiesRows] = await db.execute(
          `SELECT id, output_id, name, sort_order
           FROM template_activities
           WHERE deleted = 0 AND output_id IN (${outputPlaceholders})
           ORDER BY sort_order ASC, created_at ASC`,
          outputIds,
        );

        const activityIds = activitiesRows.map((row) => String(row.id));
        if (activityIds.length) {
          const activityPlaceholders = activityIds.map(() => "?").join(", ");

          [budgetLinesRows] = await db.execute(
            `SELECT id, activity_id, name, sort_order
             FROM template_budget_lines
             WHERE deleted = 0 AND activity_id IN (${activityPlaceholders})
             ORDER BY sort_order ASC, created_at ASC`,
            activityIds,
          );
        }
      }
    }

    const budgetLinesByActivity = budgetLinesRows.reduce((acc, row) => {
      const key = String(row.activity_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: String(row.id),
        name: row.name,
        sort_order: Number(row.sort_order || 0),
      });
      return acc;
    }, {});

    const activitiesByOutput = activitiesRows.reduce((acc, row) => {
      const key = String(row.output_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: String(row.id),
        name: row.name,
        sort_order: Number(row.sort_order || 0),
        budgetLines: budgetLinesByActivity[String(row.id)] || [],
      });
      return acc;
    }, {});

    const outputsByOutcome = outputsRows.reduce((acc, row) => {
      const key = String(row.outcome_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: String(row.id),
        name: row.name,
        sort_order: Number(row.sort_order || 0),
        activities: activitiesByOutput[String(row.id)] || [],
      });
      return acc;
    }, {});

    const outcomesByTemplate = outcomesRows.reduce((acc, row) => {
      const key = String(row.template_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        id: String(row.id),
        name: row.name,
        sort_order: Number(row.sort_order || 0),
        outputs: outputsByOutcome[String(row.id)] || [],
      });
      return acc;
    }, {});

    const yearsByTemplate = yearsRows.reduce((acc, row) => {
      const key = String(row.template_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(mapProjectYear(row));
      return acc;
    }, {});

    return templates.map((template) => ({
      id: String(template.id),
      name: template.name,
      description: template.description || "",
      status: template.status,
      outcomes: outcomesByTemplate[String(template.id)] || [],
      years: yearsByTemplate[String(template.id)] || [],
    }));
  } catch (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
};

export const fetchProjectStaffMembers = async () => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.deleted = 0
       ORDER BY u.name ASC`,
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      role: row.role_name || "Staff",
    }));
  } catch (error) {
    throw new Error(`Failed to fetch project staff members: ${error.message}`);
  }
};

export const fetchAnnualBudgetInputs = async ({ projectYearId = null, onlyAssignedToUserId = null } = {}) => {
  try {
    const values = [];
    let where = "WHERE py.deleted = 0";

    if (onlyAssignedToUserId) {
      where += " AND py.assigned_staff_id = ?";
      values.push(onlyAssignedToUserId);
    }

    if (projectYearId) {
      where += " AND abi.project_year_id = ?";
      values.push(projectYearId);
    }

    const [rows] = await db.execute(
      `SELECT abi.id, abi.project_year_id, abi.budget_line_id, abi.quantity, abi.frequency, abi.unit_cost, abi.units, abi.planned_amount, abi.actual_amount, abi.notes
       FROM annual_budget_inputs abi
       INNER JOIN project_years py ON py.id = abi.project_year_id
       ${where}
       ORDER BY abi.updated_at DESC`,
      values,
    );

    return rows.map(mapBudgetInputRow);
  } catch (error) {
    throw new Error(`Failed to fetch annual budget inputs: ${error.message}`);
  }
};

export const createProjectTemplateRecord = async ({ name, description, userId }) => {
  const normalizedName = String(name || "").trim();
  const normalizedDescription = String(description || "").trim();

  if (!normalizedName) {
    throw new GraphQLError("Template name is required.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const [[existing]] = await db.execute(
    `SELECT id FROM project_templates WHERE deleted = 0 AND LOWER(name) = LOWER(?) LIMIT 1`,
    [normalizedName],
  );

  if (existing) {
    throw new GraphQLError("A template with this name already exists.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const [templateInsertResult] = await db.execute(
    `INSERT INTO project_templates (name, description, status, created_by, updated_by)
     VALUES (?, ?, 'active', ?, ?)`,
    [normalizedName, normalizedDescription || null, userId || null, userId || null],
  );

  const templateId = String(templateInsertResult.insertId);

  return {
    success: true,
    message: "Template created successfully.",
    template: {
      id: templateId,
      name: normalizedName,
      description: normalizedDescription || "",
      status: "active",
      outcomes: [],
      years: [],
    },
  };
};

export const createProjectYearRecord = async ({ templateId, financialYear, startDate, endDate, userId }) => {
  const normalizedTemplateId = String(templateId || "").trim();
  const normalizedFinancialYear = Number(financialYear);
  const normalizedStartDate = String(startDate || "").trim();
  const normalizedEndDate = String(endDate || "").trim();

  if (!normalizedTemplateId || !Number.isFinite(normalizedFinancialYear) || !normalizedStartDate || !normalizedEndDate) {
    throw new GraphQLError("Template, financial year, start date, and end date are required.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const [[template]] = await db.execute(
    `SELECT id, status FROM project_templates WHERE id = ? AND deleted = 0 LIMIT 1`,
    [normalizedTemplateId],
  );

  if (!template) {
    throw new GraphQLError("Template not found.", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  if (String(template.status).toLowerCase() !== "active") {
    throw new GraphQLError("Cannot create year from an archived template.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const [[existingYear]] = await db.execute(
    `SELECT id
     FROM project_years
     WHERE template_id = ? AND financial_year = ? AND deleted = 0
     LIMIT 1`,
    [normalizedTemplateId, normalizedFinancialYear],
  );

  if (existingYear) {
    throw new GraphQLError(
      `A project year ${normalizedFinancialYear} already exists for this template.`,
      { extensions: { code: "BAD_USER_INPUT" } },
    );
  }

  const conn = await db.getConnection();
  let projectYearId = null;

  try {
    await conn.beginTransaction();

    const [projectYearInsertResult] = await conn.execute(
      `INSERT INTO project_years
        (template_id, financial_year, status, start_date, end_date, assigned_staff_id, created_by, updated_by)
       VALUES (?, ?, 'Planning', ?, ?, NULL, ?, ?)`,
      [normalizedTemplateId, normalizedFinancialYear, normalizedStartDate, normalizedEndDate, userId || null, userId || null],
    );

    projectYearId = String(projectYearInsertResult.insertId);

    const [budgetLines] = await conn.execute(
      `SELECT tbl.id
       FROM template_budget_lines tbl
       INNER JOIN template_activities ta ON ta.id = tbl.activity_id AND ta.deleted = 0
       INNER JOIN template_outputs tout ON tout.id = ta.output_id AND tout.deleted = 0
       INNER JOIN template_outcomes to2 ON to2.id = tout.outcome_id AND to2.deleted = 0
       WHERE to2.template_id = ? AND tbl.deleted = 0
       ORDER BY tbl.sort_order ASC, tbl.created_at ASC`,
      [normalizedTemplateId],
    );

    if (budgetLines.length) {
      const sql = `INSERT INTO annual_budget_inputs
        (project_year_id, budget_line_id, quantity, frequency, unit_cost, units, planned_amount, actual_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      for (const line of budgetLines) {
        await conn.execute(sql, [
          projectYearId,
          String(line.id),
          1,
          1,
          0,
          1,
          0,
          0,
          null,
        ]);
      }
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return {
    success: true,
    message: "Project year created successfully.",
    projectYear: {
      id: projectYearId,
      templateId: normalizedTemplateId,
      financialYear: normalizedFinancialYear,
      status: "Planning",
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      assignedStaffId: null,
    },
  };
};

export const saveProjectTemplateStructureRecord = async ({ templateId, outcomes }) => {
  const normalizedTemplateId = String(templateId || "").trim();
  const normalizedOutcomes = Array.isArray(outcomes) ? outcomes : [];

  await ensureTemplateExists(normalizedTemplateId);

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const outcomeResult = await syncStructureLevel({
      connection,
      table: "template_outcomes",
      parentColumn: "template_id",
      parentId: normalizedTemplateId,
      items: normalizedOutcomes,
      itemLabel: "Outcome",
    });

    const budgetLineCreatedIds = [];

    for (const [outcomeIndex, outcome] of normalizedOutcomes.entries()) {
      const outcomeId = outcome?.id && outcomeResult.idMap.has(String(outcome.id))
        ? outcomeResult.idMap.get(String(outcome.id))
        : outcomeResult.keptIds[outcomeIndex];

      const outputs = Array.isArray(outcome?.outputs) ? outcome.outputs : [];
      const outputResult = await syncStructureLevel({
        connection,
        table: "template_outputs",
        parentColumn: "outcome_id",
        parentId: outcomeId,
        items: outputs,
        itemLabel: "Output",
      });

      for (const [outputIndex, output] of outputs.entries()) {
        const outputId = output?.id && outputResult.idMap.has(String(output.id))
          ? outputResult.idMap.get(String(output.id))
          : outputResult.keptIds[outputIndex];

        const activities = Array.isArray(output?.activities) ? output.activities : [];
        const activityResult = await syncStructureLevel({
          connection,
          table: "template_activities",
          parentColumn: "output_id",
          parentId: outputId,
          items: activities,
          itemLabel: "Activity",
        });

        for (const [activityIndex, activity] of activities.entries()) {
          const activityId = activity?.id && activityResult.idMap.has(String(activity.id))
            ? activityResult.idMap.get(String(activity.id))
            : activityResult.keptIds[activityIndex];

          const budgetLines = Array.isArray(activity?.budgetLines)
            ? activity.budgetLines
            : [];
          const budgetLineResult = await syncStructureLevel({
            connection,
            table: "template_budget_lines",
            parentColumn: "activity_id",
            parentId: activityId,
            items: budgetLines,
            itemLabel: "Budget line",
          });
          budgetLineCreatedIds.push(...budgetLineResult.createdIds);
        }
      }
    }

    if (budgetLineCreatedIds.length) {
      const [projectYears] = await connection.execute(
        `SELECT id FROM project_years WHERE template_id = ? AND deleted = 0`,
        [normalizedTemplateId],
      );

      if (projectYears.length) {
        const insertSql = `INSERT INTO annual_budget_inputs
          (project_year_id, budget_line_id, quantity, frequency, unit_cost, units, planned_amount, actual_amount, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        for (const projectYear of projectYears) {
          for (const budgetLineId of budgetLineCreatedIds) {
            await connection.execute(insertSql, [
              String(projectYear.id),
              budgetLineId,
              1,
              1,
              0,
              1,
              0,
              0,
              null,
            ]);
          }
        }
      }
    }

    await connection.commit();

    return {
      success: true,
      message: "Template structure saved successfully.",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const assignProjectYearToStaffRecord = async ({ projectYearId, staffId, updatedBy }) => {
  const [[yearRecord]] = await db.execute(
    `SELECT id, template_id, financial_year, status, start_date, end_date, assigned_staff_id
     FROM project_years
     WHERE id = ? AND deleted = 0
     LIMIT 1`,
    [projectYearId],
  );

  if (!yearRecord) {
    throw new GraphQLError("Project year not found.", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const normalizedStaffId = staffId ? String(staffId) : null;
  if (normalizedStaffId) {
    const [[staffRecord]] = await db.execute(
      `SELECT id FROM users WHERE id = ? AND deleted = 0 LIMIT 1`,
      [normalizedStaffId],
    );

    if (!staffRecord) {
      throw new GraphQLError("Selected staff member does not exist.", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
  }

  await db.execute(
    `UPDATE project_years
     SET assigned_staff_id = ?, updated_by = ?
     WHERE id = ?`,
    [normalizedStaffId, updatedBy || null, projectYearId],
  );

  return {
    success: true,
    message: "Project year assignment updated.",
    projectYear: {
      ...mapProjectYear(yearRecord),
      assignedStaffId: normalizedStaffId,
    },
  };
};

export const upsertAnnualBudgetInputRecord = async ({ input }) => {
  const projectYearId = String(input?.projectYearId || "").trim();
  const budgetLineId = String(input?.budgetLineId || "").trim();

  if (!projectYearId || !budgetLineId) {
    throw new GraphQLError("Project year and budget line are required.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const [[existingRow]] = await db.execute(
    `SELECT id, quantity, frequency, unit_cost, units, actual_amount, notes
     FROM annual_budget_inputs
     WHERE project_year_id = ? AND budget_line_id = ?
     LIMIT 1`,
    [projectYearId, budgetLineId],
  );

  const quantity =
    input?.quantity !== undefined
      ? toNumber(input.quantity, 1)
      : toNumber(existingRow?.quantity, 1);
  const frequency =
    input?.frequency !== undefined
      ? toNumber(input.frequency, 1)
      : toNumber(existingRow?.frequency, 1);
  const unitCost =
    input?.unitCost !== undefined
      ? toNumber(input.unitCost, 0)
      : toNumber(existingRow?.unit_cost, 0);
  const units =
    input?.units !== undefined
      ? toNumber(input.units, 1)
      : toNumber(existingRow?.units, 1);
  const actualAmount =
    input?.actualAmount !== undefined
      ? toNumber(input.actualAmount, 0)
      : toNumber(existingRow?.actual_amount, 0);
  const notes = input?.notes !== undefined ? input.notes : existingRow?.notes || null;
  const plannedAmount = quantity * frequency * unitCost * units;

  await db.execute(
    `INSERT INTO annual_budget_inputs
      (project_year_id, budget_line_id, quantity, frequency, unit_cost, units, planned_amount, actual_amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       quantity = VALUES(quantity),
       frequency = VALUES(frequency),
       unit_cost = VALUES(unit_cost),
       units = VALUES(units),
       planned_amount = VALUES(planned_amount),
       actual_amount = VALUES(actual_amount),
       notes = VALUES(notes),
       updated_at = CURRENT_TIMESTAMP`,
    [
      projectYearId,
      budgetLineId,
      quantity,
      frequency,
      unitCost,
      units,
      plannedAmount,
      actualAmount,
      notes,
    ],
  );

  const [[saved]] = await db.execute(
    `SELECT id, project_year_id, budget_line_id, quantity, frequency, unit_cost, units, planned_amount, actual_amount, notes
     FROM annual_budget_inputs
     WHERE project_year_id = ? AND budget_line_id = ?
     LIMIT 1`,
    [projectYearId, budgetLineId],
  );

  return {
    success: true,
    message: "Annual budget input saved successfully.",
    budgetInput: mapBudgetInputRow(saved),
  };
};

const projectResolvers = {
  Query: {
    projectTemplates: async (_, __, context) => {
      const user = context?.req?.user;
      const scope = resolveProjectViewScope(user);

      return await fetchProjectTemplates({
        onlyAssignedToUserId: scope.onlyAssignedToUserId,
      });
    },

    projectStaffMembers: async (_, __, context) => {
      const user = context?.req?.user;
        const userPermissions = user?.permissions || [];
        const scope = resolveProjectViewScope(user);

        checkPermission(
          userPermissions,
          "can_view_projects",
          "You do not have permission to view project staff members."
        );

      return await fetchProjectStaffMembers();
    },

    annualBudgetInputs: async (_, { projectYearId }, context) => {
      const user = context?.req?.user;
        const userPermissions = user?.permissions || [];

        checkPermission(
          userPermissions,
          "can_view_projects",
          "You do not have permission to view annual budgets."
        );
      const scope = resolveProjectViewScope(context?.req?.user);

      return await fetchAnnualBudgetInputs({
        projectYearId,
        onlyAssignedToUserId: scope.onlyAssignedToUserId,
      });
    },

    annualBudgetInputsAll: async (_, __, context) => {
        const user = context?.req?.user;
        const userPermissions = user?.permissions || [];

        checkPermission(
          userPermissions,
          "can_view_projects",
          "You do not have permission to view annual budgets."
        );

        const can_view_own_projects = hasPermission(userPermissions, "can_view_own_projects");
        
      return await fetchAnnualBudgetInputs({
        onlyAssignedToUserId: can_view_own_projects ? context?.req?.user?.id : null,
      });
    },
  },

  Mutation: {
    createProjectTemplate: async (_, { input }, context) => {
        const user = context?.req?.user;
        const userPermissions = user?.permissions || [];

        checkPermission(
          userPermissions,
          "can_manage_templates",
          "You do not have permission to create project templates."
        );
      return await createProjectTemplateRecord({
        name: input?.name,
        description: input?.description,
        userId: context?.req?.user?.id || null,
      });
    },

    createProjectYearFromTemplate: async (_, { input }, context) => {
      ensureProjectWriteAccess(context, "You do not have permission to create a project year.");

      return await createProjectYearRecord({
        templateId: input?.templateId,
        financialYear: input?.financialYear,
        startDate: input?.startDate,
        endDate: input?.endDate,
        userId: context?.req?.user?.id || null,
      });
    },

    saveProjectTemplateStructure: async (_, { input }, context) => {
      ensureProjectWriteAccess(context, "You do not have permission to update project templates.");

      return await saveProjectTemplateStructureRecord({
        templateId: input?.templateId,
        outcomes: input?.outcomes,
      });
    },

    assignProjectYearToStaff: async (_, { projectYearId, staffId }, context) => {
      ensureStaffAssignAccess(context, "You do not have permission to assign project staff.");

      return await assignProjectYearToStaffRecord({
        projectYearId,
        staffId,
        updatedBy: context?.req?.user?.id || null,
      });
    },

    upsertAnnualBudgetInput: async (_, { input }, context) => {
      ensureProjectWriteAccess(context, "You do not have permission to update annual budgets.");

      return await upsertAnnualBudgetInputRecord({ input });
    },
  },
};

export default projectResolvers;
