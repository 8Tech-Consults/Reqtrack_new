import { gql } from '@apollo/client';


export const GET_ACCOUNTABILITIES = gql`
  query Accountabilities($limit: Int, $offset: Int, $search: String, $requisitionId: ID) {
    accountabilities(limit: $limit, offset: $offset, search: $search, requisitionId: $requisitionId) {
      id
      requisitionId
      reportedById
      status
      reportDate
      summary
      narrativeReport
      attachments
      totalAccountedAmount
      varianceAmount
      reviewedAt
      reviewNotes
      createdAt
      items {
        id
        accountabilityId
        requisitionItemId
        description
        accountedAmount
        bankCharges
        invoiceName
        proofOfPaymentName
        receiptName
        sortOrder
      }
      requisition { id requisitionNo }
      reportedBy { id name }
      reviewedBy { id name }
    }
  }
`;

export const SAVE_ACCOUNTABILITY = gql`
  mutation SaveAccountability($input: AccountabilityInput!) {
  saveAccountability(input: $input) {
    success
    message
    accountability { id }
  }
}
`;

export const UPDATE_ACCOUNTABILITY_STATUS = gql`
  mutation UpdateAccountabilityStatus($id: ID!, $status: String!, $notes: String) {
    updateAccountabilityStatus(id: $id, status: $status, notes: $notes) {
      id
      status
      reviewedAt
      reviewNotes
      reviewedBy { id name }
    }
  }
`;

