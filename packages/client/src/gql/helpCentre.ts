import { gql } from '@apollo/client';

export type HelpCategory = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  articleCount: number;
};

export type HelpArticle = {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  question: string;
  answer: string;
  keywords?: string | null;
  published: boolean;
  sortOrder: number;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  updatedAt?: string | null;
};

export type HelpAssistantReply = {
  answer: string;
  sources: { id: string; question: string }[];
  source: 'model' | 'fallback';
  logId?: string | null;
};

export type HelpAssistantLog = {
  id: string;
  userName?: string | null;
  question: string;
  answer?: string | null;
  source: string;
  helpful?: boolean | null;
  createdAt: string;
};

export type HelpCentreMutationResponse = {
  success: boolean;
  message: string;
  id?: string | null;
};

const ARTICLE_FIELDS = `
  id
  categoryId
  categoryName
  question
  answer
  keywords
  published
  sortOrder
  viewCount
  helpfulYes
  helpfulNo
  updatedAt
`;

export const GET_HELP_CATEGORIES = gql`
  query GetHelpCategories {
    helpCategories {
      id
      name
      description
      icon
      sortOrder
      articleCount
    }
  }
`;

export const GET_HELP_ARTICLES = gql`
  query GetHelpArticles($search: String, $categoryId: ID, $includeUnpublished: Boolean) {
    helpArticles(search: $search, categoryId: $categoryId, includeUnpublished: $includeUnpublished) {
      ${ARTICLE_FIELDS}
    }
  }
`;

export const GET_HELP_ARTICLE = gql`
  query GetHelpArticle($id: ID!) {
    helpArticle(id: $id) {
      ${ARTICLE_FIELDS}
    }
  }
`;

export const GET_HELP_ASSISTANT_LOGS = gql`
  query GetHelpAssistantLogs($limit: Int, $filter: String) {
    helpAssistantLogs(limit: $limit, filter: $filter) {
      id
      userName
      question
      answer
      source
      helpful
      createdAt
    }
  }
`;

export const ASK_HELP_ASSISTANT = gql`
  mutation AskHelpAssistant($question: String!, $history: [HelpAssistantTurn!]) {
    askHelpAssistant(question: $question, history: $history) {
      answer
      source
      logId
      sources {
        id
        question
      }
    }
  }
`;

export const RATE_ASSISTANT_ANSWER = gql`
  mutation RateAssistantAnswer($logId: ID!, $helpful: Boolean!) {
    rateAssistantAnswer(logId: $logId, helpful: $helpful)
  }
`;

export const RATE_HELP_ARTICLE = gql`
  mutation RateHelpArticle($id: ID!, $helpful: Boolean!) {
    rateHelpArticle(id: $id, helpful: $helpful) {
      id
      helpfulYes
      helpfulNo
    }
  }
`;

export const SAVE_HELP_CATEGORY = gql`
  mutation SaveHelpCategory($input: HelpCategoryInput!) {
    saveHelpCategory(input: $input) {
      success
      message
      id
    }
  }
`;

export const DELETE_HELP_CATEGORY = gql`
  mutation DeleteHelpCategory($id: ID!) {
    deleteHelpCategory(id: $id) {
      success
      message
      id
    }
  }
`;

export const SAVE_HELP_ARTICLE = gql`
  mutation SaveHelpArticle($input: HelpArticleInput!) {
    saveHelpArticle(input: $input) {
      success
      message
      id
    }
  }
`;

export const DELETE_HELP_ARTICLE = gql`
  mutation DeleteHelpArticle($id: ID!) {
    deleteHelpArticle(id: $id) {
      success
      message
      id
    }
  }
`;

export const SET_HELP_ARTICLE_PUBLISHED = gql`
  mutation SetHelpArticlePublished($id: ID!, $published: Boolean!) {
    setHelpArticlePublished(id: $id, published: $published) {
      success
      message
      id
    }
  }
`;
