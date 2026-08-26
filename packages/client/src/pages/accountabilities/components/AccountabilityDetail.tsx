import { useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { StatusBadge } from './StatusBadge';
import { Pencil, ArrowLeft } from 'lucide-react';
import type { Accountability, AccountabilityStatus } from '../accountability';
import { UPDATE_ACCOUNTABILITY_STATUS } from '@/gql/accountabilities';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions';
import { toFriendlyErrorMessage } from '@/utils';

const ACCOUNTABILITY_QUERY = gql`
  query Accountability($id: ID!) {
    accountability(id: $id) {
      id
      requisitionId
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

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' });

interface Props {
  id: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  fileBaseUrl: string; // e.g. URL_2 from your upload component
}

function FileLink({ label, name, baseUrl }: { label: string; name: string | null; baseUrl: string }) {
  if (!name) {
    return (
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-sm text-slate-300">Not attached</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <a
        href={`${baseUrl}/accountability_docs/${name}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        View file
      </a>
    </div>
  );
}

export function AccountabilityDetail({ id, onBack, onEdit, fileBaseUrl }: Props) {
  const { data, loading, error, refetch } = useQuery<
    { accountability: Accountability | null },
    { id: string }
  >(ACCOUNTABILITY_QUERY, { variables: { id } });

  const { auth } = useAuthContext();
  const permissions = getPermissionsFromToken(auth?.access_token);
  const canReviewAccountability = Boolean(permissions.can_review_accountability);

  const [pendingAction, setPendingAction] = useState<AccountabilityStatus | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [updateStatus, { loading: updatingStatus }] = useMutation<
    { updateAccountabilityStatus: { id: string; status: string } },
    { id: string; status: string; notes?: string }
  >(UPDATE_ACCOUNTABILITY_STATUS, {
    refetchQueries: ['Requisitions'],
    onCompleted: () => {
      toast.success('Accountability updated successfully');
      setPendingAction(null);
      setReviewNotes('');
      refetch();
    },
    onError: (err) => {
      toast.error(toFriendlyErrorMessage(err, 'Unable to update this accountability. Please try again.'));
    },
  });

  const confirmReview = () => {
    if (!pendingAction) return;
    updateStatus({ variables: { id, status: pendingAction, notes: reviewNotes.trim() || undefined } });
  };

  const cancelReview = () => {
    setPendingAction(null);
    setReviewNotes('');
  };

  if (loading) return <p className="text-sm text-slate-400">Loading...</p>;
  if (error) return <p className="text-sm text-red-600">Couldn't load this accountability. {error.message}</p>;

  const a = data?.accountability;
  if (!a) return <p className="text-sm text-slate-400">Not found.</p>;

  const isEditable = a.status === 'Draft' || a.status === 'Rejected' || a.status === 'Additional Info Requested';
  const canReview = canReviewAccountability && a.status !== 'Draft' && a.status !== 'Closed';
  console.log('AccountabilityDetail: canReviewAccountability', canReviewAccountability, 'canReview', canReview, 'status', a.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back
        </button>
        {isEditable && (
          <button
            onClick={() => onEdit(a.id)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{a.requisition.requisitionNo}</h2>
          <p className="text-sm text-slate-500">
            Reported by {a.reportedBy.name} · {formatDate(a.reportDate)}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </div>

      {a.summary && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Summary</p>
          <p className="text-sm text-slate-700">{a.summary}</p>
        </div>
      )}

      {a.narrativeReport && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Narrative Report</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.narrativeReport}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Total Accounted</p>
          <p className="text-base font-semibold text-slate-900">{formatMoney(a.totalAccountedAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Variance</p>
          <p className={`text-base font-semibold ${a.varianceAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {formatMoney(a.varianceAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Reviewed By</p>
          <p className="text-base font-semibold text-slate-900">{a.reviewedBy?.name ?? '—'}</p>
          {a.reviewedAt && <p className="text-xs text-slate-400">{formatDate(a.reviewedAt)}</p>}
        </div>
      </div>

      {a.reviewNotes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-700 mb-1">Review Notes</p>
          <p className="text-sm text-amber-900">{a.reviewNotes}</p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        {[...a.items].sort((x, y) => x.sortOrder - y.sortOrder).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-slate-900">{item.description}</p>
              <p className="text-sm font-semibold text-slate-900 shrink-0">{formatMoney(item.accountedAmount)}</p>
            </div>
            {item.bankCharges != null && item.bankCharges > 0 && (
              <p className="text-xs text-slate-500 mb-2">Bank charges: {formatMoney(item.bankCharges)}</p>
            )}
            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-2">
              <FileLink label="Invoice" name={item.invoiceName} baseUrl={fileBaseUrl} />
              <FileLink label="Proof of Payment" name={item.proofOfPaymentName} baseUrl={fileBaseUrl} />
              <FileLink label="Receipt" name={item.receiptName} baseUrl={fileBaseUrl} />
            </div>
          </div>
        ))}
      </div>

       {canReview && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Review</h3>

          {pendingAction ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                {pendingAction === 'Additional Info Requested'
                  ? 'Describe what additional information is needed:'
                  : 'Add closing notes (optional):'}
              </p>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelReview}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReview}
                  disabled={updatingStatus || (pendingAction === 'Additional Info Requested' && !reviewNotes.trim())}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                    pendingAction === 'Additional Info Requested' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {updatingStatus ? 'Saving...' : `Confirm ${pendingAction === 'Closed' ? 'Close' : 'Request'}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction('Additional Info Requested')}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                Request Additional Info
              </button>
              <button
                type="button"
                onClick={() => setPendingAction('Closed')}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Close Accountability
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
