import { useQuery } from '@apollo/client/react';
import clsx from 'clsx';
import { REQUISITIONSTATISSUMMARY } from '@/gql/dashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface SummaryData {
  requisitionStatusSummary: {
    pendingRequisitions: number;
    directorRequisitions: number;
    pendingAccountabilityNames: string[];
    totalAmountRequestedFormatted: string;
  };
}

const metrics = [
  { key: 'finance', label: 'Pending finance' },
  { key: 'director', label: 'Pending director Approval' },
  { key: 'accountability', label: 'Pending Accountabilities' },
  { key: 'funds', label: 'Funds disbursed' }
] as const;

const cellClass = (index: number) => clsx(
  'flex min-h-[112px] flex-col items-center justify-center px-5 py-5 text-center sm:min-h-[120px] sm:px-6',
  index % 2 === 1 && 'border-l border-slate-200',
  index >= 2 && 'border-t border-slate-200 sm:border-t-0',
  index > 0 && 'sm:border-l sm:border-slate-200'
);

const ChannelStatsSkeleton = () => (
  <div className="col-span-full grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,35,72,0.04)] sm:grid-cols-4">
    {metrics.map((metric, index) => (
      <div key={metric.key} className={cellClass(index)}>
        <Skeleton className="h-4 w-24 bg-slate-100" />
        <Skeleton className="mt-3 h-8 w-20 bg-slate-100" />
      </div>
    ))}
  </div>
);

const ChannelStats = () => {
  const { data, loading, error, refetch } = useQuery<SummaryData>(REQUISITIONSTATISSUMMARY);
  const summary = data?.requisitionStatusSummary;

  if (loading) return <ChannelStatsSkeleton />;

  if (error) {
    return (
      <div className="col-span-full flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4" role="alert">
        <p className="font-semibold text-rose-900">Dashboard totals unavailable</p>
        <button type="button" onClick={() => refetch()} className="ease-premium shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition-transform duration-150 active:scale-[0.97]">Try again</button>
      </div>
    );
  }

  const values: Record<(typeof metrics)[number]['key'], string> = {
    finance: String(summary?.pendingRequisitions ?? 0),
    director: String(summary?.directorRequisitions ?? 0),
    accountability: String(summary?.pendingAccountabilityNames?.length ?? 0),
    funds: summary?.totalAmountRequestedFormatted ?? 'UGX 0'
  };

  return (
    <section className="col-span-full grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,35,72,0.04)] sm:grid-cols-4" aria-label="Requisition summary">
      {metrics.map((metric, index) => (
        <div key={metric.key} className={cellClass(index)}>
          <p className="text-sm font-medium text-slate-500">{metric.label}</p>
          <p className="mt-2 truncate text-3xl font-semibold tracking-[-0.035em] text-[#172550]">{values[metric.key]}</p>
        </div>
      ))}
    </section>
  );
};

export { ChannelStats, ChannelStatsSkeleton };
