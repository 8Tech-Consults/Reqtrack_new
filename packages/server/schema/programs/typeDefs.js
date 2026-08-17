const programsTypeDefs = `#graphql
  type ProgramManager {
    id: ID!
    name: String!
    role: String
  }

  type ProgramBudgetLine {
    id: ID!
    name: String!
    quantity: Float!
    frequency: Float!
    unitPrice: Float!
    units: String!
    totalAmount: Float!
    sortOrder: Int!
  }

  type ProgramActivity {
    id: ID!
    name: String!
    sortOrder: Int!
    budgetLines: [ProgramBudgetLine!]!
  }

  type ProgramOutput {
    id: ID!
    name: String!
    sortOrder: Int!
    activities: [ProgramActivity!]!
  }

  type ProgramOutcome {
    id: ID!
    name: String!
    sortOrder: Int!
    outputs: [ProgramOutput!]!
  }

  type Program {
    id: ID!
    name: String!
    description: String
    budgetAmount: Float!
    programManagerId: ID
    programManagerName: String
    status: String!
    createdAt: String!
    outcomes: [ProgramOutcome!]!
  }

  type ProgramMutationResponse {
    success: Boolean!
    message: String!
    program: Program
  }

  type ProgramStructureResponse {
    success: Boolean!
    message: String!
  }

  input ProgramBudgetLineInput {
    id: ID
    name: String!
    quantity: Float!
    frequency: Float!
    unitPrice: Float!
    units: String!
    totalAmount: Float
    sortOrder: Int!
  }

  input ProgramActivityInput {
    id: ID
    name: String!
    sortOrder: Int!
    budgetLines: [ProgramBudgetLineInput!]!
  }

  input ProgramOutputInput {
    id: ID
    name: String!
    sortOrder: Int!
    activities: [ProgramActivityInput!]!
  }

  input ProgramOutcomeInput {
    id: ID
    name: String!
    sortOrder: Int!
    outputs: [ProgramOutputInput!]!
  }

  input ProgramInput {
    id: ID
    name: String!
    description: String
    budgetAmount: Float!
    programManagerId: ID
    status: String
  }

  input SaveProgramStructureInput {
    programId: ID!
    outcomes: [ProgramOutcomeInput!]!
  }

  type Query {
    programs: [Program!]!
    programManagers: [ProgramManager!]!
  }

  type Mutation {
    createProgram(input: ProgramInput!): ProgramMutationResponse!
    saveProgramStructure(input: SaveProgramStructureInput!): ProgramStructureResponse!
    deleteProgram(id: ID!): ProgramMutationResponse!
  }
`;

export default programsTypeDefs;