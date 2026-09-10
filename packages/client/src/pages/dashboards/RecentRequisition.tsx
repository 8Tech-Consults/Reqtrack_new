import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

type Requisition = { id: string; description: string; amount: string; status: 'Pending' | 'Approved' | 'Accountability' };
const requisitions: Requisition[] = [
  { id: 'REQ-001', description: 'Training workshop', amount: 'UGX 2.4M', status: 'Pending' },
  { id: 'REQ-002', description: 'Transport', amount: 'UGX 1.2M', status: 'Approved' },
  { id: 'REQ-003', description: 'Office supplies', amount: 'UGX 800K', status: 'Accountability' }
];
const badgeStyles = { Pending: 'bg-amber-50 text-amber-700 ring-amber-200', Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Accountability: 'bg-sky-50 text-sky-700 ring-sky-200' };

const StatusBadge = ({ status }: { status: Requisition['status'] }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${badgeStyles[status]}`}>{status}</span>
);

const RecentRequisitions = () => (
  <section className="h-full min-h-[360px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,35,72,0.05)]">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5">
      <h2 className="text-lg font-bold tracking-[-0.02em] text-[#172550]">Recent requisitions</h2>
      <Link to="/requisitions" className="ease-premium inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[#178eb3] outline-none transition-[background-color,transform] duration-150 hover:bg-[#e9f8fc] focus-visible:ring-2 focus-visible:ring-[#2aaed3] active:scale-[0.97]">
        View all <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>

    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-left">
        <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-5 py-3">Reference</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {requisitions.map((item) => <tr key={item.id} className="text-sm"><td className="px-5 py-5 font-bold text-[#172550]">{item.id}</td><td className="px-4 py-5 font-medium text-slate-700">{item.description}</td><td className="px-4 py-5 font-semibold text-slate-700">{item.amount}</td><td className="px-5 py-5"><StatusBadge status={item.status} /></td></tr>)}
        </tbody>
      </table>
    </div>

    <div className="divide-y divide-slate-100 sm:hidden">
      {requisitions.map((item) => <div key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#172550]">{item.id}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm font-bold text-slate-800">{item.amount}</p></div>)}
    </div>
  </section>
);

export default RecentRequisitions;
