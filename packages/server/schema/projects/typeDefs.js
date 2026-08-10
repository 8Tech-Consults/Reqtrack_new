const projectsTypeDefs = `#graphql
  type ProjectTemplate {
    id: ID!
    name: String!
    description: String
    status: String!
    outcomes: [ProjectOutcome!]!
    years: [ProjectYear!]!
  }

  type ProjectOutcome {
    id: ID!
    name: String!
    sort_order: Int!
    outputs: [ProjectOutput!]!
  }

  type ProjectOutput {
    id: ID!
    name: String!
    sort_order: Int!
    activities: [ProjectActivity!]!
  }

  type ProjectActivity {
    id: ID!
    name: String!
    sort_order: Int!
    budgetLines: [ProjectBudgetLine!]!
  }

  type ProjectBudgetLine {
    id: ID!
    name: String!
    sort_order: Int!
  }

  type ProjectYear {
    id: ID!
    templateId: ID!
    financialYear: Int!
    status: String!
    startDate: String
    endDate: String
    assignedStaffId: ID
  }

  type AnnualBudgetInput {
    id: ID!
    projectYearId: ID!
    budgetLineId: ID!
    quantity: Float!
    frequency: Float!
    unitCost: Float!
    units: Float!
    plannedAmount: Float!
    actualAmount: Float!
    notes: String
  }

  type ProjectStaffMember {
    id: ID!
    name: String!
    role: String
  }

  type ProjectTemplateMutationResponse {
    success: Boolean!
    message: String!
    template: ProjectTemplate
  }

  type ProjectYearMutationResponse {
    success: Boolean!
    message: String!
    projectYear: ProjectYear
  }

  type AnnualBudgetMutationResponse {
    success: Boolean!
    message: String!
    budgetInput: AnnualBudgetInput
  }

  input ProjectBudgetLineInput {
    id: ID
    name: String!
    sortOrder: Int!
  }

  input ProjectActivityInput {
    id: ID
    name: String!
    sortOrder: Int!
    budgetLines: [ProjectBudgetLineInput!]!
  }

  input ProjectOutputInput {
    id: ID
    name: String!
    sortOrder: Int!
    activities: [ProjectActivityInput!]!
  }

  input ProjectOutcomeInput {
    id: ID
    name: String!
    sortOrder: Int!
    outputs: [ProjectOutputInput!]!
  }

  input CreateProjectTemplateInput {
    name: String!
    description: String
  }

  input CreateProjectYearFromTemplateInput {
    templateId: ID!
    financialYear: Int!
    startDate: String!
    endDate: String!
  }

  input UpsertAnnualBudgetInputInput {
    projectYearId: ID!
    budgetLineId: ID!
    quantity: Float
    frequency: Float
    unitCost: Float
    units: Float
    actualAmount: Float
    notes: String
  }

  input SaveProjectTemplateStructureInput {
    templateId: ID!
    outcomes: [ProjectOutcomeInput!]!
  }

  type Query {
    projectTemplates: [ProjectTemplate!]!
    projectStaffMembers: [ProjectStaffMember!]!
    annualBudgetInputs(projectYearId: ID!): [AnnualBudgetInput!]!
    annualBudgetInputsAll: [AnnualBudgetInput!]!
  }

  type Mutation {
    createProjectTemplate(input: CreateProjectTemplateInput!): ProjectTemplateMutationResponse!
    createProjectYearFromTemplate(input: CreateProjectYearFromTemplateInput!): ProjectYearMutationResponse!
    saveProjectTemplateStructure(input: SaveProjectTemplateStructureInput!): ResponseMessage!
    assignProjectYearToStaff(projectYearId: ID!, staffId: ID): ProjectYearMutationResponse!
    upsertAnnualBudgetInput(input: UpsertAnnualBudgetInputInput!): AnnualBudgetMutationResponse!
  }
`;

export default projectsTypeDefs;
