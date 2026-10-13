import {AccountabilityStatus} from '@/pages/accountabilities/accountability.ts';

const STYLES: Record<AccountabilityStatus, string> = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Pending: 'bg-blue-50 text-blue-700 border-blue-200',
  Amend: 'bg-orange-50 text-orange-700 border-orange-200',
  Amended: 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-slate-200 text-slate-700 border-slate-300',
};

const LABELS: Partial<Record<AccountabilityStatus, string>> = {
  Amend: 'More Info Requested',
  Amended: 'Resubmitted',
};

export function StatusBadge({ status }: { status: AccountabilityStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status] ?? status}
    </span>
  );
}