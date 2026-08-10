import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import type { Accountability, AccountabilitiesVars } from '@/pages/accountabilities/accountability';
import { StatusBadge } from './StatusBadge';
import { Search, Plus } from 'lucide-react';
import { GET_ACCOUNTABILITIES } from '@/gql/accountabilities';

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n);

interface Props {
  requisitionId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

const PAGE_SIZE = 20;

export function AccountabilitiesList(
    {  
        requisitionId,
        onSelect, 
        onCreate 
    }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, loading, error } = useQuery(
    GET_ACCOUNTABILITIES,
    { variables: {
        limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    requisitionId,
    }, fetchPolicy: 'cache-and-network' }
  );
  

  const rows = data?.accountabilities ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search accountabilities..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Accountability
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">Couldn't load accountabilities. {error.message}</p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2.5 font-medium">Requisition</th>
              <th className="px-4 py-2.5 font-medium">Reported By</th>
              <th className="px-4 py-2.5 font-medium">Report Date</th>
              <th className="px-4 py-2.5 font-medium text-right">Accounted</th>
              <th className="px-4 py-2.5 font-medium text-right">Variance</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No accountabilities found.</td></tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.requisition.requisitionNo}</td>
                <td className="px-4 py-2.5 text-slate-600">{row.reportedBy.name}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {new Date(row.reportDate).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{formatMoney(row.totalAccountedAmount)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${row.varianceAmount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatMoney(row.varianceAmount)}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={rows.length < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}