export type AccountabilityStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Additional Info Requested'
  | 'Closed';

export interface AccountabilitiesVars {
  limit?: number;
  offset?: number;
  search?: string;
  requisitionId?: string;
}

export interface AccountabilityItem {
  id: string;
  accountabilityId: string;
  requisitionItemId: string;
  description: string;
  accountedAmount: number;
  bankCharges: number | null;
  invoiceName: string | null;
  proofOfPaymentName: string | null;
  receiptName: string | null;
  sortOrder: number;
}

export interface Accountability {
  id: string;
  requisitionId: string;
  reportedById: string;
  status: AccountabilityStatus;
  reportDate: string;
  summary: string | null;
  narrativeReport: string | null;
  attachments: string[] | null;
  totalAccountedAmount: number;
  varianceAmount: number;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  items: AccountabilityItem[];
  requisition: { id: string; requisitionNo: string };
  reportedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
}

export interface AccountabilityItemInput {
  id: string | null;
  accountedAmount: number | null;
  bankCharges: number | null;
  description: string | null;
  invoice: File | null;
  proofOfPayment: File | null;
  receipt: File | null;
  requisitionItemId: string | null;
}

export interface AccountabilityInput {
  id: string | null;
  items: AccountabilityItemInput[];
  reportDate: string | null;
  requisitionId: string | null;
  status: AccountabilityStatus | null;
  summary: string | null;
}