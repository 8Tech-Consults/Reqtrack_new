// Frontend-first GraphQL operation stubs for Projects module.
// These are intentionally kept as document strings so backend hookup can map 1:1 later.

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
        outputs {
          id
          name
          activities {
            id
            name
            budgetLines {
              id
              name
              quantity
              frequency
              unitCost
              units
              amount
              actualAmount
            }
          }
        }
      }
      years {
        id
        financialYear
        status
        startDate
        endDate
      }
    }
  }
`;

export const CREATE_PROJECT_YEAR_FROM_TEMPLATE_MUTATION = `
  mutation CreateProjectYearFromTemplate($input: CreateProjectYearFromTemplateInput!) {
    createProjectYearFromTemplate(input: $input) {
      id
      templateId
      financialYear
      status
      startDate
      endDate
      assignedStaffId
    }
  }
`;

export const ASSIGN_PROJECT_YEAR_TO_STAFF_MUTATION = `
  mutation AssignProjectYearToStaff($projectYearId: ID!, $staffId: ID) {
    assignProjectYearToStaff(projectYearId: $projectYearId, staffId: $staffId) {
      id
      assignedStaffId
    }
  }
`;

export interface CreateProjectYearFromTemplateInput {
  templateId: string;
  financialYear: number;
  startDate: string;
  endDate: string;
}
