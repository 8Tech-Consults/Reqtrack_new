import { useQuery } from '@apollo/client/react';
import { AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react';
import { ACCOUNTABILITY_HIGHLIGHTS } from '@/gql/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface IHighlightsProps { limit?: number }
interface AccountabilityHighlightsData {
  accountabilityHighlights: {
    totalAccountedAmountFormatted: string;
    percentChange: number | null;
    statusBreakdown: { closedPercent: number; pendingPercent: number; haltedPercent: number };
    recent: Array<{ requisitionNo: string; totalAccountedAmount: number; overBudget: boolean }>;
  };
}

const currency = (value: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', notation: 'compact', maximumFractionDigits: 1 }).format(value);

const Highlights = ({ limit = 5 }: IHighlightsProps) => {
  const { data, loading, error } = useQuery<AccountabilityHighlightsData, { limit: number }>(ACCOUNTABILITY_HIGHLIGHTS, { variables: { limit } });
  const highlights = data?.accountabilityHighlights;
  const breakdown = highlights?.statusBreakdown;

  return (
    <section className="h-full min-h-[360px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#172550]">Accountability</h2>
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#e9f8fc] text-[#178eb3]"><FileCheck2 className="size-5" aria-hidden="true" /></span>
      </div>

      {loading ? (
        <div className="mt-6">
          <Skeleton className="h-3 w-28 bg-slate-100" /><Skeleton className="mt-3 h-9 w-44 bg-slate-100" />
          <Skeleton className="mt-6 h-2 w-full rounded-full bg-slate-100" />
          <div className="mt-7 space-y-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-11 w-full bg-slate-100" />)}</div>
        </div>
      ) : error ? (
        <div className="flex min-h-56 items-center justify-center text-sm text-rose-700" role="alert">Accountability data is unavailable.</div>
      ) : (
        <>
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-500">Total accounted</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <p className="text-3xl font-bold tracking-[-0.04em] text-[#172550]">{highlights?.totalAccountedAmountFormatted ?? 'UGX 0'}</p>
              {highlights?.percentChange != null && (
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${highlights.percentChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {highlights.percentChange >= 0 ? '+' : ''}{highlights.percentChange}%
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-label="Accountability status breakdown">
            <span className="bg-[#3aa76d]" style={{ width: `${breakdown?.closedPercent ?? 0}%` }} />
            <span className="bg-[#e8ae32]" style={{ width: `${breakdown?.pendingPercent ?? 0}%` }} />
            <span className="bg-[#df5b65]" style={{ width: `${breakdown?.haltedPercent ?? 0}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500">
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#3aa76d]" />Closed {breakdown?.closedPercent ?? 0}%</span>
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#e8ae32]" />Pending {breakdown?.pendingPercent ?? 0}%</span>
            <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#df5b65]" />Halted {breakdown?.haltedPercent ?? 0}%</span>
          </div>

          <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
            {highlights?.recent.slice(0, limit).map((row) => (
              <div key={row.requisitionNo} className="flex items-center gap-3 py-3.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${row.overBudget ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {row.overBudget ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                </span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{row.requisitionNo}</p><p className="text-xs text-slate-500">{row.overBudget ? 'Over budget' : 'Within budget'}</p></div>
                <span className="ml-auto shrink-0 text-xs font-bold text-[#172550]">{currency(row.totalAccountedAmount)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export { Highlights, type IHighlightsProps };
