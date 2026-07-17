import { CreateProjectYearFromTemplateInput } from '@/gql/projects';

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

const seedTemplates: ProjectTemplate[] = [
  {
    id: 'tpl-disability-inclusion',
    name: 'Disability Inclusion Program',
    description: 'Support disability inclusion through training, service access, and community support.',
    status: 'active',
    outcomes: [
      {
        id: 'outcome-1',
        name: 'Improved access to inclusive services',
        outputs: [
          {
            id: 'output-1-1',
            name: 'Teachers trained on inclusive education',
            activities: [
              {
                id: 'activity-1',
                name: 'Conduct teacher training workshops',
                budgetLines: [
                  {
                    id: 'bl-1',
                    name: 'Training materials'
                  },
                  {
                    id: 'bl-2',
                    name: 'Transport refund'
                  },
                  {
                    id: 'bl-3',
                    name: 'Meals'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: 'outcome-2',
        name: 'Stronger district coordination',
        outputs: [
          {
            id: 'output-2-1',
            name: 'District planning sessions conducted',
            activities: [
              {
                id: 'activity-2',
                name: 'Conduct district review meetings',
                budgetLines: [
                  {
                    id: 'bl-4',
                    name: 'Venue'
                  },
                  {
                    id: 'bl-5',
                    name: 'Printing'
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    years: [
      {
        id: 'prj-2025-disability',
        templateId: 'tpl-disability-inclusion',
        financialYear: 2025,
        status: 'Approved',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        assignedStaffId: 'staff-1'
      },
      {
        id: 'prj-2026-disability',
        templateId: 'tpl-disability-inclusion',
        financialYear: 2026,
        status: 'Planning',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignedStaffId: 'staff-2'
      }
    ]
  },
  {
    id: 'tpl-community-rehab',
    name: 'Community Rehabilitation Support',
    description: 'Community-based rehabilitation and assistive support interventions.',
    status: 'active',
    outcomes: [
      {
        id: 'outcome-3',
        name: 'Expanded access to rehabilitation services',
        outputs: [
          {
            id: 'output-3-1',
            name: 'Regional outreach clinics delivered',
            activities: [
              {
                id: 'activity-3',
                name: 'Run quarterly outreach clinics',
                budgetLines: [
                  {
                    id: 'bl-6',
                    name: 'Medical supplies'
                  },
                  {
                    id: 'bl-7',
                    name: 'Accommodation'
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    years: [
      {
        id: 'prj-2026-rehab',
        templateId: 'tpl-community-rehab',
        financialYear: 2026,
        status: 'Planning',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        assignedStaffId: null
      }
    ]
  }
];

const staffMembersStore: StaffMember[] = [
  { id: 'staff-1', name: 'Grace Nansubuga', role: 'Program Officer' },
  { id: 'staff-2', name: 'Paul Kato', role: 'Finance Officer' },
  { id: 'staff-3', name: 'Sarah Nakirya', role: 'M&E Specialist' },
  { id: 'staff-4', name: 'David Ssemanda', role: 'Operations Officer' }
];

let templatesStore: ProjectTemplate[] = structuredClone(seedTemplates);

let annualBudgetsStore: Record<string, Record<string, AnnualBudgetInput>> = {
  'prj-2025-disability': {
    'bl-1': { budgetLineId: 'bl-1', quantity: 1, frequency: 1, unitCost: 12000000, units: 1, actualAmount: 6800000 },
    'bl-2': { budgetLineId: 'bl-2', quantity: 70, frequency: 1, unitCost: 128571, units: 1, actualAmount: 5400000 },
    'bl-3': { budgetLineId: 'bl-3', quantity: 70, frequency: 1, unitCost: 85714, units: 1, actualAmount: 3900000 },
    'bl-4': { budgetLineId: 'bl-4', quantity: 4, frequency: 1, unitCost: 1250000, units: 1, actualAmount: 2200000 },
    'bl-5': { budgetLineId: 'bl-5', quantity: 1, frequency: 1, unitCost: 1800000, units: 1, actualAmount: 850000 }
  },
  'prj-2026-disability': {
    'bl-1': { budgetLineId: 'bl-1', quantity: 1, frequency: 1, unitCost: 13000000, units: 1, actualAmount: 0 },
    'bl-2': { budgetLineId: 'bl-2', quantity: 75, frequency: 1, unitCost: 135000, units: 1, actualAmount: 0 },
    'bl-3': { budgetLineId: 'bl-3', quantity: 75, frequency: 1, unitCost: 90000, units: 1, actualAmount: 0 },
    'bl-4': { budgetLineId: 'bl-4', quantity: 6, frequency: 1, unitCost: 1300000, units: 1, actualAmount: 0 },
    'bl-5': { budgetLineId: 'bl-5', quantity: 1, frequency: 1, unitCost: 2100000, units: 1, actualAmount: 0 }
  },
  'prj-2026-rehab': {
    'bl-6': { budgetLineId: 'bl-6', quantity: 1, frequency: 1, unitCost: 10500000, units: 1, actualAmount: 0 },
    'bl-7': { budgetLineId: 'bl-7', quantity: 20, frequency: 1, unitCost: 420000, units: 1, actualAmount: 0 }
  }
};

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const listProjectTemplatesWithYears = async (): Promise<ProjectTemplate[]> => {
  return structuredClone(templatesStore);
};

export const createProjectTemplate = async (
  input: CreateProjectTemplateInput
): Promise<ProjectTemplate> => {
  const name = input.name.trim();
  const description = input.description.trim();

  if (!name) {
    throw new Error('Template name is required.');
  }

  const duplicate = templatesStore.some((template) => template.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    throw new Error('A template with this name already exists.');
  }

  const created: ProjectTemplate = {
    id: randomId('tpl'),
    name,
    description: description || 'No description provided.',
    status: 'active',
    outcomes: [],
    years: []
  };

  templatesStore = [created, ...templatesStore];
  return structuredClone(created);
};

export const listStaffMembers = async (): Promise<StaffMember[]> => {
  return structuredClone(staffMembersStore);
};

export const calculateBudgetLineAmount = (budgetLine: AnnualBudgetInput): number => {
  return budgetLine.quantity * budgetLine.frequency * budgetLine.unitCost * budgetLine.units;
};

const getBudgetLineIdsFromTemplate = (template: ProjectTemplate): string[] => {
  const ids: string[] = [];
  template.outcomes.forEach((outcome) => {
    outcome.outputs.forEach((output) => {
      output.activities.forEach((activity) => {
        activity.budgetLines.forEach((budgetLine) => {
          ids.push(budgetLine.id);
        });
      });
    });
  });
  return ids;
};

const initializeYearBudgets = (projectYearId: string, template: ProjectTemplate) => {
  const ids = getBudgetLineIdsFromTemplate(template);
  annualBudgetsStore[projectYearId] = ids.reduce<Record<string, AnnualBudgetInput>>((acc, budgetLineId) => {
    acc[budgetLineId] = {
      budgetLineId,
      quantity: 1,
      frequency: 1,
      unitCost: 0,
      units: 1,
      actualAmount: 0
    };
    return acc;
  }, {});
};

export const listAnnualBudgetsByYear = async (
  projectYearId: string
): Promise<Record<string, AnnualBudgetInput>> => {
  return structuredClone(annualBudgetsStore[projectYearId] || {});
};

export const listAllAnnualBudgets = async (): Promise<Record<string, Record<string, AnnualBudgetInput>>> => {
  return structuredClone(annualBudgetsStore);
};

export const upsertAnnualBudgetInput = async (
  projectYearId: string,
  budgetLineId: string,
  patch: Partial<AnnualBudgetInput>
): Promise<AnnualBudgetInput> => {
  if (!annualBudgetsStore[projectYearId]) {
    annualBudgetsStore[projectYearId] = {};
  }

  const existing = annualBudgetsStore[projectYearId][budgetLineId] || {
    budgetLineId,
    quantity: 1,
    frequency: 1,
    unitCost: 0,
    units: 1,
    actualAmount: 0
  };

  const next: AnnualBudgetInput = {
    ...existing,
    ...patch,
    budgetLineId
  };

  annualBudgetsStore[projectYearId][budgetLineId] = next;
  return structuredClone(next);
};

export const createProjectYearFromTemplate = async (
  input: CreateProjectYearFromTemplateInput
): Promise<ProjectYearInstance> => {
  const template = templatesStore.find((item) => item.id === input.templateId);

  if (!template) {
    throw new Error('Template not found.');
  }

  if (template.status !== 'active') {
    throw new Error('Cannot create year from an archived template.');
  }

  const duplicate = template.years.some((year) => year.financialYear === input.financialYear);
  if (duplicate) {
    throw new Error(`A project year ${input.financialYear} already exists for this template.`);
  }

  const created: ProjectYearInstance = {
    id: randomId('prj'),
    templateId: input.templateId,
    financialYear: input.financialYear,
    status: 'Planning',
    startDate: input.startDate,
    endDate: input.endDate,
    assignedStaffId: null
  };

  template.years = [created, ...template.years].sort((a, b) => b.financialYear - a.financialYear);
  initializeYearBudgets(created.id, template);
  return structuredClone(created);
};

export const assignProjectYearToStaff = async (
  projectYearId: string,
  staffId: string | null
): Promise<ProjectYearInstance> => {
  for (const template of templatesStore) {
    const year = template.years.find((item) => item.id === projectYearId);
    if (!year) continue;

    if (staffId) {
      const exists = staffMembersStore.some((staff) => staff.id === staffId);
      if (!exists) {
        throw new Error('Selected staff member does not exist.');
      }
    }

    year.assignedStaffId = staffId;
    return structuredClone(year);
  }

  throw new Error('Project year not found.');
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
