const requisitionsTypeDefs = `#graphql
  type RequisitionProgramOption {
    projectYearId: ID!
    templateId: ID!
    programName: String!
    financialYear: Int!
  }

  type RequisitionSimpleOption {
    id: ID!
    name: String!
  }

  type RequisitionBudgetLineOption {
    id: ID!
    activityId: ID!
    name: String!
    quantity: Float!
    frequency: Float!
    unitCost: Float!
    units: String!
    plannedAmount: Float!
    actualAmount: Float!
  }

  enum RequisitionStatus {
    Pending
    Approved
    Rejected
    AmendmentRequested
    Accepted
    Amended
    Closed
  }

  type RequisitionItem {
    id: ID!
    budgetLineId: ID
    description: String!
    quantity: Float!
    frequency: Float!
    unitCost: Float!
    units: String!
    amount: Float!
  }

  type Requisition {
    id: ID!
    requisitionNo: String!
    programId: ID!
    program: Program!
    outcome: ProgramOutcome
    output: ProgramOutput
    activity: ProgramActivity
    outcomeId: ID
    outputId: ID
    activityId: ID
    requestedById: ID!
    requestedBy: User!
    title: String!
    purpose: String
    conceptNotePath: String
    conceptNoteName: String
    status: String!
    rejectionReason: String
    reason: String
    totalRequestedAmount: Float!
    createdAt: String!
    items: [RequisitionItem!]!
  }

  input CreateRequisitionItemInput {
    id: ID
    budgetLineId: ID!
    quantity: Float
    frequency: Float
    unitCost: Float
    units: String
    description: String
  }

  input RequisitionInput {
    id: ID
    programId: ID!
    outcomeId: ID
    outputId: ID
    activityId: ID
    title: String!
    purpose: String
    conceptNote: Upload
    status: String
    items: [CreateRequisitionItemInput!]!
  }

  type RequisitionMutationResponse {
    success: Boolean!
    message: String!
    requisition: Requisition
  }

  type Query {
    requisitions(limit: Int, offset: Int, search: String): [Requisition!]!
    requisition(id: ID!): Requisition
    requisitionPrograms: [RequisitionProgramOption!]!
    requisitionOutcomes(projectYearId: ID!): [RequisitionSimpleOption!]!
    requisitionOutputs(outcomeId: ID!): [RequisitionSimpleOption!]!
    requisitionActivities(outputId: ID!): [RequisitionSimpleOption!]!
    requisitionBudgetLines(projectYearId: ID!, activityId: ID!): [RequisitionBudgetLineOption!]!
  }

  type Mutation {
    createRequisition(input: RequisitionInput!): RequisitionMutationResponse!
    updateRequisitionStatus(id: ID!, status: String!, reason: String): Requisition!
    deleteRequisition(id: ID!): Boolean!
  }
`;

export default requisitionsTypeDefs;
