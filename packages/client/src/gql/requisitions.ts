import { gql } from '@apollo/client';

export const GET_REQUISITIONS = gql`
  query Requisitions($limit: Int, $offset: Int, $search: String) {
  requisitions(limit: $limit, offset: $offset, search: $search) {
    id
    requisitionNo
    programId
    outcomeId
    outputId
    activityId
    title
    purpose
    conceptNotePath
    conceptNoteName
    status
    rejectionReason
    reason
    totalRequestedAmount
    createdAt
    items {
      id
      budgetLineId
      description
      quantity
      frequency
      unitCost
      units
      amount
    }
    requestedById
    requestedBy {
      id
      email
      name
      staffDetails {
        signature
      }
    }
    program {
      id
      name
    }
    activity {
      id
      name
    }
    outcome {
      id
      name
    }
    output {
      id
      name
    }
  }
}
`;

export const GET_REQUISITION_PROGRAMS = gql`
  query RequisitionPrograms {
    requisitionPrograms {
      programId
      templateId
      programName
      financialYear
    }
  }
`;

export const GET_REQUISITION_OUTCOMES = gql`
  query RequisitionOutcomes($projectYearId: ID!) {
    requisitionOutcomes(projectYearId: $projectYearId) {
      id
      name
    }
  }
`;

export const GET_REQUISITION_OUTPUTS = gql`
  query RequisitionOutputs($outcomeId: ID!) {
    requisitionOutputs(outcomeId: $outcomeId) {
      id
      name
    }
  }
`;

export const GET_REQUISITION_ACTIVITIES = gql`
  query RequisitionActivities($outputId: ID!) {
    requisitionActivities(outputId: $outputId) {
      id
      name
    }
  }
`;

export const GET_REQUISITION_BUDGET_LINES = gql`
  query RequisitionBudgetLines($projectYearId: ID!, $activityId: ID!) {
    requisitionBudgetLines(projectYearId: $projectYearId, activityId: $activityId) {
      id
      activityId
      name
      quantity
      frequency
      unitCost
      units
      plannedAmount
      actualAmount
    }
  }
`;

export const SAVE_REQUISITION = gql`
  mutation CreateRequisition($input: RequisitionInput!) {
    createRequisition(input: $input) {
      success
      message
      requisition {
        id
        requisitionNo
        programId
        requestedBy {
          id
          name
        }
        title
        purpose
        conceptNotePath
        conceptNoteName
        status
        totalRequestedAmount
        createdAt
        items {
          id
          budgetLineId
          description
          quantity
          frequency
          unitCost
          units
          amount
          # sortOrder
        }
      }
    }
  }
`;

export const DELETE_REQUISITION = gql`
  mutation DeleteRequisition($id: ID!) {
    deleteRequisition(id: $id)
  }
`;

export const UPDATE_REQUISITION_STATUS = gql`
  mutation UpdateRequisitionStatus($id: ID!, $status: String!, $reason: String) {
    updateRequisitionStatus(id: $id, status: $status, reason: $reason) {
      id
      status
      rejectionReason
    }
  }
`;
