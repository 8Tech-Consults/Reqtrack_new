import {AccountabilityStatus} from '@/pages/accountabilities/accountability.ts';

const STYLES: Record<AccountabilityStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  'Under Review': 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-green-50 text-green-700 border-green-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  'Additional Info Requested': 'bg-orange-50 text-orange-700 border-orange-200',
  Closed: 'bg-slate-200 text-slate-700 border-slate-300',
};

export function StatusBadge({ status }: { status: AccountabilityStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}