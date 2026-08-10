export const PROJECT_TEMPLATES_WITH_YEARS_QUERY = `
  query ProjectTemplatesWithYears {
    projectTemplates {
      id
      name
      description
      status
      outcomes {
        id
        name
        sort_order
        outputs {
          id
          name
          sort_order
          activities {
            id
            name
            sort_order
            budgetLines {
              id
              name
              sort_order
            }
          }
        }
      }
      years {
        id
        templateId
        financialYear
        status
        startDate
        endDate
        assignedStaffId
      }
    }
  }
`;

export const PROJECT_STAFF_MEMBERS_QUERY = `
  query ProjectStaffMembers {
    projectStaffMembers {
      id
      name
      role
    }
  }
`;

export const ANNUAL_BUDGET_INPUTS_ALL_QUERY = `
  query AnnualBudgetInputsAll {
    annualBudgetInputsAll {
      id
      projectYearId
      budgetLineId
      quantity
      frequency
      unitCost
      units
      plannedAmount
      actualAmount
      notes
    }
  }
`;

export const ANNUAL_BUDGET_INPUTS_BY_YEAR_QUERY = `
  query AnnualBudgetInputs($projectYearId: ID!) {
    annualBudgetInputs(projectYearId: $projectYearId) {
      id
      projectYearId
      budgetLineId
      quantity
      frequency
      unitCost
      units
      plannedAmount
      actualAmount
      notes
    }
  }
`;

export const CREATE_PROJECT_TEMPLATE_MUTATION = `
  mutation CreateProjectTemplate($input: CreateProjectTemplateInput!) {
    createProjectTemplate(input: $input) {
      success
      message
      template {
        id
        name
        description
        status
      }
    }
  }
`;

export const CREATE_PROJECT_YEAR_FROM_TEMPLATE_MUTATION = `
  mutation CreateProjectYearFromTemplate($input: CreateProjectYearFromTemplateInput!) {
    createProjectYearFromTemplate(input: $input) {
      success
      message
      projectYear {
        id
        templateId
        financialYear
        status
        startDate
        endDate
        assignedStaffId
      }
    }
  }
`;

export const SAVE_PROJECT_TEMPLATE_STRUCTURE_MUTATION = `
  mutation SaveProjectTemplateStructure($input: SaveProjectTemplateStructureInput!) {
    saveProjectTemplateStructure(input: $input) {
      success
      message
    }
  }
`;

export const ASSIGN_PROJECT_YEAR_TO_STAFF_MUTATION = `
  mutation AssignProjectYearToStaff($projectYearId: ID!, $staffId: ID) {
    assignProjectYearToStaff(projectYearId: $projectYearId, staffId: $staffId) {
      success
      message
      projectYear {
        id
        templateId
        financialYear
        status
        startDate
        endDate
        assignedStaffId
      }
    }
  }
`;

export const UPSERT_ANNUAL_BUDGET_INPUT_MUTATION = `
  mutation UpsertAnnualBudgetInput($input: UpsertAnnualBudgetInputInput!) {
    upsertAnnualBudgetInput(input: $input) {
      success
      message
      budgetInput {
        id
        projectYearId
        budgetLineId
        quantity
        frequency
        unitCost
        units
        plannedAmount
        actualAmount
        notes
      }
    }
  }
`;

export interface CreateProjectYearFromTemplateInput {
  templateId: string;
  financialYear: number;
  startDate: string;
  endDate: string;
}
