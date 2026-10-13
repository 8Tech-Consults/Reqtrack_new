import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_REQUISITIONS } from '@/gql/requisitions';
import {
  formatMoney,
  requisitionStatusLabel,
  type RequisitionRecord,
} from '@/pages/requisitions/blocks/RequisitionsList';

const RECENT_LIMIT = 5;

const badgeStyles: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Amended: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Amendment Requested': 'bg-violet-50 text-violet-700 ring-violet-200',
  Accepted: 'bg-sky-50 text-sky-700 ring-sky-200',
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  Closed: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${badgeStyles[status] ?? badgeStyles.Closed}`}>{requisitionStatusLabel(status)}</span>
);

const RecentRequisitions = () => {
  // Same query as the requisitions list, so it follows the same visibility rules.
  const { data, loading, error } = useQuery<{ requisitions: RequisitionRecord[] }>(GET_REQUISITIONS, {
    variables: { limit: RECENT_LIMIT, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });
  const requisitions = data?.requisitions ?? [];
  const emptyMessage = loading && !data
    ? 'Loading requisitions...'
    : error
      ? 'Recent requisitions are unavailable.'
      : 'No requisitions yet.';

  return (
    <section className="h-full min-h-[360px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#172550]">Recent requisitions</h2>
        <Link to="/requisitions" className="ease-premium inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[#178eb3] outline-none transition-[background-color,transform] duration-150 hover:bg-[#e9f8fc] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.97]">
          View all <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {requisitions.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-5 py-3">Reference</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {requisitions.map((item) => <tr key={item.id} className="text-sm"><td className="px-5 py-5 font-bold text-[#172550]">{item.requisitionNo}</td><td className="px-4 py-5 font-medium text-slate-700">{item.title}</td><td className="px-4 py-5 font-semibold text-slate-700">{formatMoney(item.totalRequestedAmount)}</td><td className="px-5 py-5"><StatusBadge status={item.status} /></td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 sm:hidden">
            {requisitions.map((item) => <div key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#172550]">{item.requisitionNo}</p><p className="mt-1 text-sm text-slate-600">{item.title}</p></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm font-bold text-slate-800">{formatMoney(item.totalRequestedAmount)}</p></div>)}
          </div>
        </>
      )}
    </section>
  );
};

export default RecentRequisitions;
