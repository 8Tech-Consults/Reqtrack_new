import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface DisbursementChartProps {
  expenseData?: Array<{ month: number; totalAmount: number }>;
  loading: boolean;
  error?: Error;
  year: number;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatCompact = (value: number) => new Intl.NumberFormat('en-UG', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const formatCurrency = (value: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(value);

const DisbursementChart = ({ expenseData, loading, error, year }: DisbursementChartProps) => {
  if (loading) {
    return (
      <section className="min-h-[390px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
        <div className="flex justify-between gap-4">
          <div className="space-y-2"><Skeleton className="h-5 w-52 bg-slate-100" /><Skeleton className="h-3 w-64 bg-slate-100" /></div>
          <Skeleton className="h-8 w-20 rounded-lg bg-slate-100" />
        </div>
        <Skeleton className="mt-8 h-[270px] w-full rounded-xl bg-slate-100" />
      </section>
    );
  }

  const byMonth = new Map((expenseData ?? []).map((entry) => [entry.month, entry.totalAmount]));
  const chartData = months.map((month, index) => ({ month, amount: byMonth.get(index + 1) ?? 0 }));
  const total = chartData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="min-h-[390px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-1 pt-5">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#172550]">Funds disbursed</h2>
        <div className="text-right">
          <span className="rounded-lg bg-[#e9f8fc] px-2.5 py-1.5 text-xs font-bold text-[#178eb3]">{year}</span>
          <p className="mt-2 text-sm font-bold text-[#172550]">{formatCurrency(total)}</p>
        </div>
      </div>

      {error ? (
        <div className="flex h-[285px] items-center justify-center text-sm text-rose-700" role="alert">Disbursement data is unavailable.</div>
      ) : (
        <div className="h-[300px] w-full px-2 pb-3 pt-4 sm:px-4" role="img" aria-label={`Monthly funds disbursed in ${year}, totaling ${formatCurrency(total)}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 300 }}>
            <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="nadDisbursementFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2aaed3" stopOpacity={0.32} />
                  <stop offset="88%" stopColor="#2aaed3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e8edf3" strokeDasharray="3 5" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7d8ca5', fontSize: 11 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7d8ca5', fontSize: 11 }} tickFormatter={formatCompact} width={58} />
              <Tooltip cursor={{ stroke: '#9bdcec', strokeWidth: 1, strokeDasharray: '4 4' }} content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_12px_30px_rgba(15,35,72,0.14)]">
                  <p className="text-xs font-medium text-slate-500">{label} {year}</p>
                  <p className="mt-1 text-sm font-bold text-[#172550]">{formatCurrency(Number(payload[0].value))}</p>
                </div>
              ) : null} />
              <Area type="monotone" dataKey="amount" stroke="#2aaed3" strokeWidth={3} fill="url(#nadDisbursementFill)" activeDot={{ r: 5, fill: '#172550', stroke: '#ffffff', strokeWidth: 3 }} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export { DisbursementChart };
