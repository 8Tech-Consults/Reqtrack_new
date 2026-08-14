import { gql } from '@apollo/client';

export const REQUISITIONSTATISSUMMARY= gql`
query RequisitionStatusSummary {
  requisitionStatusSummary {
    totalRequisitions
    pendingRequisitions
    directorRequisitions
    approvedRequisitions
    rejectedRequisitions
    haltedRequisitions
    pendingAccountabilityNames
    totalAmountRequested
    totalAmountRequestedFormatted
    accountabilitiesThisMonth
    closedAccountabilitiesThisMonth
  }
}
`;

export const REQUISITIONSTATUSCHART= gql`
query RequisitionStatusChart {
  requisitionStatusChart {
    total
    pendingCount
    approvedCount
    requireAmendmentCount
    rejectedCount
    amendedCount
    acceptedCount
  }
}
`;

export const MONTHLYREQUISITIONEXPENSE = gql`
query YearExpense($year: Int!) {
  yearExpense(year: $year) {
    month
    totalAmount
  }
}
`;

export const ACCOUNTABILITY_HIGHLIGHTS = gql`
query AccountabilityHighlights($limit: Int) {
  accountabilityHighlights(limit: $limit) {
    totalAccountedAmount
    totalAccountedAmountFormatted
    percentChange
    statusBreakdown {
      closedPercent
      pendingPercent
      haltedPercent
    }
    recent {
      id
      requisitionNo
      reportDate
      totalAccountedAmount
      assignedAmount
      varianceAmount
      overBudget
    }
  }
}
`;