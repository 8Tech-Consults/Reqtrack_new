const helpCentreTypeDefs = `#graphql
  type HelpCategory {
    id: ID!
    name: String!
    description: String
    icon: String
    sortOrder: Int!
    articleCount: Int!
  }

  type HelpArticle {
    id: ID!
    categoryId: ID
    categoryName: String
    question: String!
    answer: String!
    keywords: String
    published: Boolean!
    sortOrder: Int!
    viewCount: Int!
    helpfulYes: Int!
    helpfulNo: Int!
    updatedAt: String
  }

  type HelpAssistantSource {
    id: ID!
    question: String!
  }

  type HelpAssistantReply {
    answer: String!
    sources: [HelpAssistantSource!]!
    "model = AI-written answer, fallback = closest articles listed (no AI provider available)"
    source: String!
    logId: ID
  }

  type HelpAssistantLog {
    id: ID!
    userName: String
    question: String!
    answer: String
    source: String!
    helpful: Boolean
    createdAt: String!
  }

  input HelpAssistantTurn {
    role: String!
    content: String!
  }

  input HelpCategoryInput {
    id: ID
    name: String!
    description: String
    icon: String
    sortOrder: Int
  }

  input HelpArticleInput {
    id: ID
    categoryId: ID
    question: String!
    answer: String!
    keywords: String
    published: Boolean
    sortOrder: Int
  }

  type HelpCentreMutationResponse {
    success: Boolean!
    message: String!
    id: ID
  }

  extend type Query {
    helpCategories: [HelpCategory!]!
    helpArticles(search: String, categoryId: ID, includeUnpublished: Boolean): [HelpArticle!]!
    helpArticle(id: ID!): HelpArticle
    "Admin only (can_manage_help_centre). filter: all | unhelpful | not_covered"
    helpAssistantLogs(limit: Int, filter: String): [HelpAssistantLog!]!
  }

  extend type Mutation {
    askHelpAssistant(question: String!, history: [HelpAssistantTurn!]): HelpAssistantReply!
    rateAssistantAnswer(logId: ID!, helpful: Boolean!): Boolean!
    rateHelpArticle(id: ID!, helpful: Boolean!): HelpArticle

    saveHelpCategory(input: HelpCategoryInput!): HelpCentreMutationResponse!
    deleteHelpCategory(id: ID!): HelpCentreMutationResponse!
    saveHelpArticle(input: HelpArticleInput!): HelpCentreMutationResponse!
    deleteHelpArticle(id: ID!): HelpCentreMutationResponse!
    setHelpArticlePublished(id: ID!, published: Boolean!): HelpCentreMutationResponse!
  }
`;

export default helpCentreTypeDefs;
