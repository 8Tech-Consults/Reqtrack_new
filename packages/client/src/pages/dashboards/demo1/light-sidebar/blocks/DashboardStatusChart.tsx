import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface RequisitionStatusChart {
  pendingCount: number;
  acceptedCount: number;
  approvedCount: number;
  rejectedCount: number;
  requireAmendmentCount: number;
  amendedCount: number;
}

interface DashboardStatusChartProps {
  data?: RequisitionStatusChart;
  loading: boolean;
  error?: Error;
}

const statusConfig = [
  { key: 'pendingCount', name: 'Pending', color: '#e8ae32' },
  { key: 'acceptedCount', name: 'Accepted', color: '#2aaed3' },
  { key: 'approvedCount', name: 'Approved', color: '#3aa76d' },
  { key: 'rejectedCount', name: 'Rejected', color: '#df5b65' },
  { key: 'requireAmendmentCount', name: 'Needs amendment', color: '#7357d9' },
  { key: 'amendedCount', name: 'Amended', color: '#7d8ca5' }
] as const;

const DashboardStatusChart = ({ data, loading, error }: DashboardStatusChartProps) => {
  if (loading) {
    return (
      <section className="min-h-[390px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
        <Skeleton className="h-5 w-44 bg-slate-100" />
        <Skeleton className="mt-2 h-3 w-56 bg-slate-100" />
        <div className="flex justify-center py-7"><Skeleton className="size-44 rounded-full bg-slate-100" /></div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-4 bg-slate-100" />)}
        </div>
      </section>
    );
  }

  const chartData = statusConfig.map((item) => ({ name: item.name, value: data?.[item.key] ?? 0, color: item.color }));
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="min-h-[390px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
      <h2 className="text-lg font-bold tracking-[-0.02em] text-[#172550]">Request status</h2>

      {error ? (
        <div className="flex h-56 items-center justify-center text-sm text-rose-700" role="alert">Status data is unavailable.</div>
      ) : (
        <>
          <div className="relative mx-auto h-52 max-w-[260px]" role="img" aria-label={`${total} requisitions grouped by workflow status`}>
            {total === 0 && <span className="pointer-events-none absolute left-1/2 top-1/2 size-[168px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[22px] border-slate-100" aria-hidden="true" />}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 260, height: 208 }}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={84} paddingAngle={total > 0 ? 3 : 0} stroke="none" isAnimationActive={false}>
                  {chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_30px_rgba(15,35,72,0.14)]">
                    <p className="text-xs font-medium text-slate-500">{payload[0].name}</p>
                    <p className="mt-0.5 text-sm font-bold text-[#172550]">{Number(payload[0].value).toLocaleString()}</p>
                  </div>
                ) : null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tracking-[-0.04em] text-[#172550]">{total}</span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Requests</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="truncate text-xs text-slate-500">{item.name}</span>
                <span className="ml-auto text-xs font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export { DashboardStatusChart, type RequisitionStatusChart };
