import { getAuth } from '@/auth/_helpers';
import { MAIN_URL } from '@/config';
import {
  ANNUAL_BUDGET_INPUTS_ALL_QUERY,
  ANNUAL_BUDGET_INPUTS_BY_YEAR_QUERY,
  ASSIGN_PROJECT_YEAR_TO_STAFF_MUTATION,
  CREATE_PROJECT_TEMPLATE_MUTATION,
  CREATE_PROJECT_YEAR_FROM_TEMPLATE_MUTATION,
  PROJECT_STAFF_MEMBERS_QUERY,
  PROJECT_TEMPLATES_WITH_YEARS_QUERY,
  SAVE_PROJECT_TEMPLATE_STRUCTURE_MUTATION,
  UPSERT_ANNUAL_BUDGET_INPUT_MUTATION,
  CreateProjectYearFromTemplateInput
} from '@/gql/projects';

export interface BudgetLineNode {
  id: string;
  name: string;
}

export interface AnnualBudgetInput {
  budgetLineId: string;
  quantity: number;
  frequency: number;
  unitCost: number;
  units: number;
  actualAmount: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface ActivityNode {
  id: string;
  name: string;
  budgetLines: BudgetLineNode[];
}

export interface OutputNode {
  id: string;
  name: string;
  activities: ActivityNode[];
}

export interface OutcomeNode {
  id: string;
  name: string;
  outputs: OutputNode[];
}

export interface ProjectYearInstance {
  id: string;
  templateId: string;
  financialYear: number;
  status: 'Planning' | 'Approved' | 'Archived';
  startDate: string;
  endDate: string;
  assignedStaffId?: string | null;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  outcomes: OutcomeNode[];
  years: ProjectYearInstance[];
}

export interface CreateProjectTemplateInput {
  name: string;
  description: string;
}

interface SaveableBudgetLineNode {
  id?: string;
  name: string;
}

interface SaveableActivityNode {
  id?: string;
  name: string;
  budgetLines: SaveableBudgetLineNode[];
}

interface SaveableOutputNode {
  id?: string;
  name: string;
  activities: SaveableActivityNode[];
}

interface SaveableOutcomeNode {
  id?: string;
  name: string;
  outputs: SaveableOutputNode[];
}
const graphqlRequest = async <TData>(query: string, variables?: Record<string, unknown>): Promise<TData> => {
  const auth = getAuth();
  const token = auth?.access_token;

  const response = await fetch(MAIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });

  const payload = await response.json();

  if (!response.ok || payload?.errors?.length) {
    const message = payload?.errors?.[0]?.message || 'Request failed.';
    throw new Error(message);
  }

  return payload.data as TData;
};

const mapAnnualBudgetInput = (input: {
  budgetLineId: string;
  quantity: number;
  frequency: number;
  unitCost: number;
  units: number;
  actualAmount: number;
}): AnnualBudgetInput => ({
  budgetLineId: input.budgetLineId,
  quantity: Number(input.quantity || 0),
  frequency: Number(input.frequency || 0),
  unitCost: Number(input.unitCost || 0),
  units: Number(input.units || 0),
  actualAmount: Number(input.actualAmount || 0)
});

export const listProjectTemplatesWithYears = async (): Promise<ProjectTemplate[]> => {
  const data = await graphqlRequest<{
    projectTemplates: Array<{
      id: string;
      name: string;
      description: string;
      status: 'active' | 'archived';
      outcomes: Array<{
        id: string;
        name: string;
        outputs: Array<{
          id: string;
          name: string;
          activities: Array<{
            id: string;
            name: string;
            budgetLines: Array<{ id: string; name: string }>;
          }>;
        }>;
      }>;
      years: ProjectYearInstance[];
    }>;
  }>(PROJECT_TEMPLATES_WITH_YEARS_QUERY);

  return data.projectTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description || '',
    status: template.status,
    outcomes: template.outcomes,
    years: template.years
  }));
};

export const createProjectTemplate = async (
  input: CreateProjectTemplateInput
): Promise<ProjectTemplate> => {
  const data = await graphqlRequest<{
    createProjectTemplate: {
      success: boolean;
      message: string;
      template: {
        id: string;
        name: string;
        description: string;
        status: 'active' | 'archived';
      } | null;
    };
  }>(CREATE_PROJECT_TEMPLATE_MUTATION, {
    input: {
      name: input.name,
      description: input.description
    }
  });

  if (!data.createProjectTemplate.success || !data.createProjectTemplate.template) {
    throw new Error(data.createProjectTemplate.message || 'Failed to create template.');
  }

  return {
    ...data.createProjectTemplate.template,
    outcomes: [],
    years: []
  };
};

export const saveProjectTemplateStructure = async (
  templateId: string,
  outcomes: SaveableOutcomeNode[]
): Promise<void> => {
  const normalizedOutcomes = outcomes.map((outcome, outcomeIndex) => ({
    ...(outcome.id && !outcome.id.startsWith('outcome-') ? { id: outcome.id } : {}),
    name: outcome.name,
    sortOrder: outcomeIndex,
    outputs: outcome.outputs.map((output, outputIndex) => ({
      ...(output.id && !output.id.startsWith('output-') ? { id: output.id } : {}),
      name: output.name,
      sortOrder: outputIndex,
      activities: output.activities.map((activity, activityIndex) => ({
        ...(activity.id && !activity.id.startsWith('activity-') ? { id: activity.id } : {}),
        name: activity.name,
        sortOrder: activityIndex,
        budgetLines: activity.budgetLines.map((budgetLine, budgetLineIndex) => ({
          ...(budgetLine.id && !budgetLine.id.startsWith('bl-') ? { id: budgetLine.id } : {}),
          name: budgetLine.name,
          sortOrder: budgetLineIndex
        }))
      }))
    }))
  }));

  const data = await graphqlRequest<{
    saveProjectTemplateStructure: {
      success: boolean;
      message: string;
    };
  }>(SAVE_PROJECT_TEMPLATE_STRUCTURE_MUTATION, {
    input: {
      templateId,
      outcomes: normalizedOutcomes
    }
  });

  if (!data.saveProjectTemplateStructure.success) {
    throw new Error(data.saveProjectTemplateStructure.message || 'Failed to save template structure.');
  }
};

export const listStaffMembers = async (): Promise<StaffMember[]> => {
  const data = await graphqlRequest<{
    projectStaffMembers: Array<{ id: string; name: string; role?: string | null }>;
  }>(PROJECT_STAFF_MEMBERS_QUERY);

  return data.projectStaffMembers.map((item) => ({
    id: item.id,
    name: item.name,
    role: item.role || 'Staff'
  }));
};

export const calculateBudgetLineAmount = (budgetLine: AnnualBudgetInput): number => {
  return budgetLine.quantity * budgetLine.frequency * budgetLine.unitCost * budgetLine.units;
};

export const listAnnualBudgetsByYear = async (
  projectYearId: string
): Promise<Record<string, AnnualBudgetInput>> => {
  const data = await graphqlRequest<{
    annualBudgetInputs: Array<{
      budgetLineId: string;
      quantity: number;
      frequency: number;
      unitCost: number;
      units: number;
      actualAmount: number;
    }>;
  }>(ANNUAL_BUDGET_INPUTS_BY_YEAR_QUERY, { projectYearId });

  return data.annualBudgetInputs.reduce<Record<string, AnnualBudgetInput>>((acc, item) => {
    acc[item.budgetLineId] = mapAnnualBudgetInput(item);
    return acc;
  }, {});
};

export const listAllAnnualBudgets = async (): Promise<Record<string, Record<string, AnnualBudgetInput>>> => {
  const data = await graphqlRequest<{
    annualBudgetInputsAll: Array<{
      projectYearId: string;
      budgetLineId: string;
      quantity: number;
      frequency: number;
      unitCost: number;
      units: number;
      actualAmount: number;
    }>;
  }>(ANNUAL_BUDGET_INPUTS_ALL_QUERY);

  return data.annualBudgetInputsAll.reduce<Record<string, Record<string, AnnualBudgetInput>>>((acc, item) => {
    if (!acc[item.projectYearId]) {
      acc[item.projectYearId] = {};
    }

    acc[item.projectYearId][item.budgetLineId] = mapAnnualBudgetInput(item);
    return acc;
  }, {});
};

export const upsertAnnualBudgetInput = async (
  projectYearId: string,
  budgetLineId: string,
  patch: Partial<AnnualBudgetInput>
): Promise<AnnualBudgetInput> => {
  const data = await graphqlRequest<{
    upsertAnnualBudgetInput: {
      success: boolean;
      message: string;
      budgetInput: {
        budgetLineId: string;
        quantity: number;
        frequency: number;
        unitCost: number;
        units: number;
        actualAmount: number;
      } | null;
    };
  }>(UPSERT_ANNUAL_BUDGET_INPUT_MUTATION, {
    input: {
      projectYearId,
      budgetLineId,
      quantity: patch.quantity,
      frequency: patch.frequency,
      unitCost: patch.unitCost,
      units: patch.units,
      actualAmount: patch.actualAmount
    }
  });

  const saved = data.upsertAnnualBudgetInput.budgetInput;
  if (!data.upsertAnnualBudgetInput.success || !saved) {
    throw new Error(data.upsertAnnualBudgetInput.message || 'Failed to save annual budget input.');
  }

  return mapAnnualBudgetInput(saved);
};

export const createProjectYearFromTemplate = async (
  input: CreateProjectYearFromTemplateInput
): Promise<ProjectYearInstance> => {
  const data = await graphqlRequest<{
    createProjectYearFromTemplate: {
      success: boolean;
      message: string;
      projectYear: ProjectYearInstance | null;
    };
  }>(CREATE_PROJECT_YEAR_FROM_TEMPLATE_MUTATION, { input });

  if (!data.createProjectYearFromTemplate.success || !data.createProjectYearFromTemplate.projectYear) {
    throw new Error(data.createProjectYearFromTemplate.message || 'Failed to create project year.');
  }

  return data.createProjectYearFromTemplate.projectYear;
};

export const assignProjectYearToStaff = async (
  projectYearId: string,
  staffId: string | null
): Promise<ProjectYearInstance> => {
  const data = await graphqlRequest<{
    assignProjectYearToStaff: {
      success: boolean;
      message: string;
      projectYear: ProjectYearInstance | null;
    };
  }>(ASSIGN_PROJECT_YEAR_TO_STAFF_MUTATION, {
    projectYearId,
    staffId
  });

  if (!data.assignProjectYearToStaff.success || !data.assignProjectYearToStaff.projectYear) {
    throw new Error(data.assignProjectYearToStaff.message || 'Failed to assign staff.');
  }

  return data.assignProjectYearToStaff.projectYear;
};

export const getHierarchyCounts = (template: ProjectTemplate) => {
  const outcomeCount = template.outcomes.length;
  const outputCount = template.outcomes.reduce((acc, outcome) => acc + outcome.outputs.length, 0);
  const activityCount = template.outcomes.reduce(
    (acc, outcome) =>
      acc + outcome.outputs.reduce((outputAcc, output) => outputAcc + output.activities.length, 0),
    0
  );
  const budgetLineCount = template.outcomes.reduce(
    (acc, outcome) =>
      acc +
      outcome.outputs.reduce(
        (outputAcc, output) =>
          outputAcc +
          output.activities.reduce(
            (activityAcc, activity) => activityAcc + activity.budgetLines.length,
            0
          ),
        0
      ),
    0
  );

  return {
    outcomeCount,
    outputCount,
    activityCount,
    budgetLineCount
  };
};
