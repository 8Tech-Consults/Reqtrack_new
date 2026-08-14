const dashboardTypeDefs = `#graphql
  type RequisitionStatusSummary {
    totalRequisitions: Int!
    pendingRequisitions: Int!
    directorRequisitions: Int!
    approvedRequisitions: Int!
    rejectedRequisitions: Int!
    haltedRequisitions: Int!
    pendingAccountabilityNames: [String!]!
    totalAmountRequested: Float!
    totalAmountRequestedFormatted: String!
    accountabilitiesThisMonth: Int!
    closedAccountabilitiesThisMonth: Int!
  }

  type RequisitionStatusChart {
    total: Int!
    pendingCount: Int!
    approvedCount: Int!
    rejectedCount: Int!
    requireAmendmentCount: Int!
    amendedCount: Int!
    acceptedCount: Int!
  }

  type ActivityAmount {
    label: String!
    value: Float!
  }

  type ActivityRequisitionData {
    chartData: [ActivityAmount!]!
    programs: [Program!]!
  }

  type AccountabilitySubmissionProgress {
    submittedPercent: Float!
    pendingPercent: Float!
    pendingCount: Int!
    haltedCount: Int!
    acceptedCount: Int!
  }

  type ProgramBudgetSummary {
    usedPercent: Float
    balancePercent: Float
    budget: Float
    used: Float
    programs: [Program!]!
  }

  type MonthlyExpense {
    month: Int!
    totalAmount: Float!
  }

  type BudgetComparisonItem {
    activityName: String!
    outputName: String!
    outcomeName: String!
    budget: Float!
    amountUsed: Float!
  }

  type BudgetComparisonData {
    chartData: [BudgetComparisonItem!]!
    programs: [Program!]!
  }

  type BudgetUtilizationNode {
    name: String!
    utilization: Float!
    budgetAmount: Float!
    parentBudget: Float!
    level: Int!
  }

  type ProgramHierarchyActivity {
    name: String!
    budgetAmount: Float!
    utilization: Float!
  }

  type ProgramHierarchyOutput {
    name: String!
    budgetAmount: Float!
    utilization: Float!
    activities: [ProgramHierarchyActivity!]!
  }

  type ProgramHierarchyOutcome {
    name: String!
    budgetAmount: Float!
    utilization: Float!
    outputs: [ProgramHierarchyOutput!]!
  }

  type ProgramHierarchy {
    programName: String!
    programBudget: Float
    outcomes: [ProgramHierarchyOutcome!]!
  }

  type AccountabilityStatusBreakdown {
  closedPercent: Float!
  pendingPercent: Float!
  haltedPercent: Float!
}

type RecentAccountability {
  id: ID!
  requisitionNo: String!
  reportDate: String!
  totalAccountedAmount: Float!
  assignedAmount: Float!
  varianceAmount: Float!
  overBudget: Boolean!
}

type AccountabilityHighlights {
  totalAccountedAmount: Float!
  totalAccountedAmountFormatted: String!
  percentChange: Float
  statusBreakdown: AccountabilityStatusBreakdown!
  recent: [RecentAccountability!]!
}

  type Query {
    requisitionStatusSummary: RequisitionStatusSummary! 
    requisitionStatusChart: RequisitionStatusChart!
    activityRequisitionData(programId: ID): ActivityRequisitionData!
    accountabilitySubmissionProgress: AccountabilitySubmissionProgress!
    programBudgetSummary(programId: ID): ProgramBudgetSummary!
    yearExpense(year: Int!): [MonthlyExpense!]!
    budgetComparisonData(programId: ID): BudgetComparisonData!
    budgetUtilization: [BudgetUtilizationNode!]!
    programHierarchy(programId: ID!): ProgramHierarchy!
    accountabilityHighlights(limit: Int): AccountabilityHighlights!
  }
`;

export default dashboardTypeDefs;