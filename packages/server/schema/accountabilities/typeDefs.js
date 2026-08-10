const accountabilitiesTypeDefs = `#graphql

  type AccountabilityItem {
    id: ID!
    accountabilityId: ID!
    requisitionItemId: ID
    description: String!
    accountedAmount: Float!
    bankCharges: Float!
    invoiceName: String
    proofOfPaymentName: String
    receiptName: String
    sortOrder: Int
  }

  type AccountabilityRecord {
    id: ID!
    requisitionId: ID!
    requisition: Requisition
    reportedById: ID!
    reportedBy: User!
    status: String!
    reportDate: String
    summary: String
    narrativeReport: String
    attachments: [String!]
    totalAccountedAmount: Float!
    varianceAmount: Float!
    reviewedBy: User
    reviewedAt: String
    reviewNotes: String
    createdAt: String!
    items: [AccountabilityItem!]!
  }

  type AccountabilityMutationResponse {
    success: Boolean!
    message: String!
    accountability: AccountabilityRecord
  }

  input AccountabilityItemInput {
    id: ID
    requisitionItemId: ID
    description: String!
    accountedAmount: Float!
    bankCharges: Float
    invoice: Upload
    proofOfPayment: Upload
    receipt: Upload
  }

  input AccountabilityInput {
    id: ID
    requisitionId: ID!
    reportDate: String
    summary: String
    status: String
    items: [AccountabilityItemInput!]!
  }

  extend type Query {
    accountabilities(limit: Int, offset: Int, search: String, requisitionId: ID): [AccountabilityRecord!]!
    accountability(id: ID!): AccountabilityRecord
  }

  extend type Mutation {
    saveAccountability(input: AccountabilityInput!): AccountabilityMutationResponse!
    updateAccountabilityStatus(id: ID!, status: String!, notes: String): AccountabilityRecord!
    deleteAccountability(id: ID!): Boolean!
  }
`;

export default accountabilitiesTypeDefs;
