import { useState } from 'react';
import { Upload, Trash2, Plus } from 'lucide-react';
import { Accountability, AccountabilityItemInput } from '../accountability';
import { GET_ACCOUNTABILITIES, SAVE_ACCOUNTABILITY } from '@/gql/accountabilities'; 
import {AccountabilityStatus} from '@/pages/accountabilities/accountability.ts';
import { useMutation } from '@apollo/client/react';

interface RequisitionItemOption {
  id: string;
  description: string;
  amount: number;
}

interface Props {
  requisitionId: string;
  requisitionItems: RequisitionItemOption[]; // items available to account for, from the parent requisition
  existing?: Accountability | null;          // pass when editing
  onSaved: (id: string) => void;
  onCancel: () => void;
}

function emptyItem(): AccountabilityItemInput {
  return {
    id: null,
    accountedAmount: null,
    bankCharges: null,
    description: null,
    invoice: null,
    proofOfPayment: null,
    receipt: null,
    requisitionItemId: null,
  };
}

const FileSlot = ({
  label,
  file,
  existingName,
  onChange,
}: {
  label: string;
  file: File | null;
  existingName?: string | null;
  onChange: (f: File | null) => void;
}) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-slate-500">{label}</label>
    <div className="relative rounded-lg border border-dashed border-slate-300 p-2 text-center hover:bg-slate-50">
      <input
        type="file"
        accept="application/pdf,image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
        <Upload size={13} />
        {file ? file.name : existingName ? existingName : 'Upload'}
      </div>
    </div>
  </div>
);

export function AccountabilityForm({ requisitionId, requisitionItems, existing, onSaved, onCancel }: Props) {
  const [save, { loading, error }] = useMutation<{
    saveAccountability: { success: boolean; message: string; accountability: { id: string } | null };
  }, { input: import('../accountability').AccountabilityInput }>(
    SAVE_ACCOUNTABILITY,
    { refetchQueries: [GET_ACCOUNTABILITIES] }
  );;

  const [reportDate, setReportDate] = useState(
    existing?.reportDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  );
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [status, setStatus] = useState<AccountabilityStatus>(existing?.status ?? 'Draft');
  const [items, setItems] = useState<AccountabilityItemInput[]>(
    existing?.items?.length
      ? existing.items.map((it) => ({
          id: it.id,
          accountedAmount: it.accountedAmount,
          bankCharges: it.bankCharges,
          description: it.description,
          invoice: null,
          proofOfPayment: null,
          receipt: null,
          requisitionItemId: it.requisitionItemId,
        }))
      : [emptyItem()]
  );

  const updateItem = (index: number, patch: Partial<AccountabilityItemInput>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const totalAccounted = items.reduce((sum, it) => sum + (it.accountedAmount ?? 0) + (it.bankCharges ?? 0), 0);

  const handleSubmit = async (submitStatus: AccountabilityStatus) => {
    const { data } = await save({
      variables: {
        input: {
          id: existing?.id ?? null,
          requisitionId,
          reportDate,
          summary: summary || null,
          status: submitStatus,
          items,
        },
      },
    });
    const savedId = data?.saveAccountability.accountability?.id;
    if (savedId) onSaved(savedId);
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSubmit(status); }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Summary</label>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary of this accountability"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Items</h3>
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus size={14} /> Add item
          </button>
        </div>

        {items.map((item, index) => {
          const linked = requisitionItems.find((ri) => ri.id === item.requisitionItemId);
          return (
            <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-3">
                <select
                  value={item.requisitionItemId ?? ''}
                  onChange={(e) => {
                    const ri = requisitionItems.find((r) => r.id === e.target.value);
                    updateItem(index, {
                      requisitionItemId: e.target.value || null,
                      description: ri?.description ?? item.description,
                    });
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Link to requisition item (optional)</option>
                  {requisitionItems.map((ri) => (
                    <option key={ri.id} value={ri.id}>{ri.description}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <input
                value={item.description ?? ''}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                placeholder="Item description"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Accounted Amount (UGX)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.accountedAmount ?? ''}
                    onChange={(e) => updateItem(index, { accountedAmount: e.target.value ? Number(e.target.value) : null })}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Bank Charges (UGX)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.bankCharges ?? ''}
                    onChange={(e) => updateItem(index, { bankCharges: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FileSlot label="Invoice" file={item.invoice} onChange={(f) => updateItem(index, { invoice: f })} />
                <FileSlot label="Proof of Payment" file={item.proofOfPayment} onChange={(f) => updateItem(index, { proofOfPayment: f })} />
                <FileSlot label="Receipt" file={item.receipt} onChange={(f) => updateItem(index, { receipt: f })} />
              </div>

              {linked && (
                <p className="text-xs text-slate-400">
                  Requisitioned: {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(linked.amount)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-sm font-medium text-slate-600">Total Accounted</span>
        <span className="text-base font-semibold text-slate-900">
          {new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(totalAccounted)}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => handleSubmit('Draft')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
