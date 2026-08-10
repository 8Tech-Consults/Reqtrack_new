import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useQuery } from '@apollo/client/react';
import { formatMoney, RequisitionRecord } from '../blocks/RequisitionsList';
import { GET_PROGRAMS, ProgramRecord } from '@/gql/programs';
import { URL_2 } from '@/config/urls';
import { Upload } from 'lucide-react';

type DraftRequisitionItem = {
  id?: string;
  budgetLineId: string;
  budgetLineName: string;
  description: string;
  quantity: number;
  frequency: number;
  unitCost: number;
  units: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (values: Record<string, any>) => void;
  initialValues?: RequisitionRecord | null;
  saving?: boolean;
};

const RequisitionFormSheet = ({ open, onOpenChange, initialValues, onSave, saving }: Props) => {
  const isEdit = Boolean(initialValues?.id);

  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [projectYearId, setProjectYearId] = useState('');
  const [outcomeId, setOutcomeId] = useState('');
  const [outputId, setOutputId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [budgetLineId, setBudgetLineId] = useState('');
  const [conceptNote, setConceptNote] = useState<File | null>(null);
  const [conceptNotePreview, setConceptNotePreview] = useState<string | null>(null);;
  const [items, setItems] = useState<DraftRequisitionItem[]>([]);

  const { data } = useQuery<{ programs: ProgramRecord[] }>(GET_PROGRAMS, {
    fetchPolicy: 'network-only',
  });
  const programOptions = data?.programs || [];

  const selectedProgram = useMemo(
    () => programOptions.find((p) => p.id === projectYearId) || null,
    [programOptions, projectYearId]
  );

  const outcomeOptions = useMemo(() => selectedProgram?.outcomes || [], [selectedProgram]);

  const selectedOutcome = useMemo(
    () => outcomeOptions.find((o) => o.id === outcomeId) || null,
    [outcomeOptions, outcomeId]
  );

  const outputOptions = useMemo(() => selectedOutcome?.outputs || [], [selectedOutcome]);

  const selectedOutput = useMemo(
    () => outputOptions.find((o) => o.id === outputId) || null,
    [outputOptions, outputId]
  );

  const activityOptions = useMemo(() => selectedOutput?.activities || [], [selectedOutput]);

  const selectedActivity = useMemo(
    () => activityOptions.find((a) => a.id === activityId) || null,
    [activityOptions, activityId]
  );

  const budgetLineOptions = useMemo(() => selectedActivity?.budgetLines || [], [selectedActivity]);

  useEffect(() => {
    if (!open) return;
    setTitle(initialValues?.title || '');
    setPurpose(initialValues?.purpose || '');
    setProjectYearId(initialValues?.programId || '');
    setOutcomeId(initialValues?.outcomeId || '');
    setOutputId(initialValues?.outputId || '');
    setActivityId(initialValues?.activityId || '');
    setBudgetLineId('');
    setConceptNote(null);
    setConceptNotePreview(initialValues?.conceptNoteName || null);
    setItems(
      (initialValues?.items || []).map((item) => ({
        id: item.id,
        budgetLineId: item.budgetLineId || '',
        budgetLineName: item.description,
        description: item.description,
        quantity: item.quantity,
        frequency: item.frequency,
        unitCost: item.unitCost,
        units: String(item.units),
      }))
    );
  }, [open, initialValues]);



  const addBudgetLine = () => {
    if (!budgetLineId) return;
    const selected = budgetLineOptions.find((option) => option.id === budgetLineId);
    if (!selected) return;
    if (items.some((item) => item.budgetLineId === selected.id)) return;

    setItems((prev) => [
      ...prev,
      {
        id: undefined,
        budgetLineId: selected.id,
        budgetLineName: selected.name,
        description: selected.name,
        quantity: Number(selected.quantity || 1),
        frequency: Number(selected.frequency || 1),
        unitCost: Number(selected.unitPrice || 0),
        units: String(selected.units ?? ''),
      },
    ]);
  };

  const updateItem = (id: string, field: keyof DraftRequisitionItem, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.budgetLineId === id
          ? {
              ...item,
              [field]: field === 'description' || field === 'units' ? value : Number.isFinite(Number(value)) ? Number(value) : 0,
            }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.budgetLineId !== id));
  };

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.frequency * item.unitCost, 0),
    [items]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({
        id: initialValues?.id || null,
        title,
        purpose,
        projectYearId,
        outcomeId,
        outputId,
        activityId,
        conceptNote,
        items,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[800px] h-full flex flex-col p-0">
        <div className="p-6 border-b bg-slate-50/50">
          <SheetHeader>
            <SheetTitle>{isEdit ? 'Edit Requisition' : 'New Requisition'}</SheetTitle>
            <SheetDescription>Provide the details below</SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label-text font-medium">Program</label>
              <select className="select select-bordered w-full" value={projectYearId} onChange={(e) => { setProjectYearId(e.target.value); setOutcomeId(''); setOutputId(''); setActivityId(''); setBudgetLineId(''); }}>
                <option value="">Select program</option>
                {programOptions.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text font-medium">Outcome</label>
              <select className="select select-bordered w-full" value={outcomeId} onChange={(e) => { setOutcomeId(e.target.value); setOutputId(''); setActivityId(''); setBudgetLineId(''); }} disabled={!projectYearId}>
                <option value="">Select outcome</option>
                {outcomeOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text font-medium">Output</label>
              <select className="select select-bordered w-full" value={outputId} onChange={(e) => { setOutputId(e.target.value); setActivityId(''); setBudgetLineId(''); }} disabled={!outcomeId}>
                <option value="">Select output</option>
                {outputOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text font-medium">Activity</label>
              <select className="select select-bordered w-full" value={activityId} onChange={(e) => { setActivityId(e.target.value); setBudgetLineId(''); }} disabled={!outputId}>
                <option value="">Select activity</option>
                {activityOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <div className="grid md:grid-cols-[1fr_auto] gap-2">
              <select className="select select-bordered w-full" value={budgetLineId} onChange={(e) => setBudgetLineId(e.target.value)} disabled={!activityId}>
                <option value="">Select budget line</option>
                {budgetLineOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-light" onClick={addBudgetLine}>Add Budget Line</button>
            </div>

            {!!items.length && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.budgetLineId} className="rounded border border-slate-200 p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.budgetLineName}</p>
                      <button type="button" className="btn btn-xs btn-light-danger" onClick={() => removeItem(item.budgetLineId)}>
                        Remove
                      </button>
                    </div>
                    <input
                      className="input input-bordered w-full"
                      value={item.description}
                      onChange={(e) => updateItem(item.budgetLineId, 'description', e.target.value)}
                      placeholder="Item description"
                      readOnly
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <label className="text-xs text-slate-500">Quantity</label>
                      <label className="text-xs text-slate-500">Frequency</label>
                      <label className="text-xs text-slate-500">Unit Cost</label>
                      <label className="text-xs text-slate-500">Units</label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input className="input input-bordered" type="number" value={item.quantity} onChange={(e) => updateItem(item.budgetLineId, 'quantity', e.target.value)} placeholder="Qty" />
                      <input className="input input-bordered" type="number" value={item.frequency} onChange={(e) => updateItem(item.budgetLineId, 'frequency', e.target.value)} placeholder="Frequency" />
                      <input className="input input-bordered" type="number" value={item.unitCost} onChange={(e) => updateItem(item.budgetLineId, 'unitCost', e.target.value)} placeholder="Unit cost" />
                      <input className="input input-bordered"  value={item.units} onChange={(e) => updateItem(item.budgetLineId, 'units', e.target.value)} placeholder="Units" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Amount: {formatMoney(item.quantity * item.frequency * item.unitCost)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label-text font-medium">Brief Description</label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the request"
            />
          </div>

          

          <div className="space-y-2">
  <label className="text-sm font-medium">Concept Note</label>
  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
    <input
      type="file"
      className="absolute inset-0 opacity-0 cursor-pointer z-0"
      accept=".pdf"
      onChange={(e) => {
        const file = e.target.files?.[0] || null;
        setConceptNote(file);
        if (file) setConceptNotePreview(URL.createObjectURL(file));
      }}
    />
    {conceptNote || conceptNotePreview ? (
      <div className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
        {conceptNotePreview && (
          <a
            href={
              conceptNote
                ? conceptNotePreview // blob URL for a newly-picked file
                : `${URL_2}/concept_notes/${conceptNotePreview}` // server path for existing file
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 font-medium pointer-events-auto relative z-20"
          >
            View Concept Note
          </a>
        )}
        <p className="text-xs text-blue-600 font-medium">
          {conceptNote ? conceptNote.name : 'Existing Concept Note (Click to change)'}
        </p>
      </div>
    ) : (
      <>
        <Upload className="mx-auto text-slate-400 mb-2" size={20} />
        <p className="text-xs text-slate-500">Click to upload PDF (Max 2MB)</p>
      </>
    )}
  </div>
</div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-semibold text-slate-900">{formatMoney(total)}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary px-8" disabled={saving || !items.length}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Requisition'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export { RequisitionFormSheet };
