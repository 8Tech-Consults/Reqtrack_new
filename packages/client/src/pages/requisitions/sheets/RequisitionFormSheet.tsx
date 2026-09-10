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

type FieldErrors = {
  projectYearId?: string;
  outcomeId?: string;
  outputId?: string;
  activityId?: string;
  purpose?: string;
  conceptNote?: string;
  items?: string; // general "add at least one line" / "total must be > 0" message
};

type ItemFieldErrors = {
  quantity?: string;
  frequency?: string;
  unitCost?: string;
  units?: string;
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
  const [conceptNotePreview, setConceptNotePreview] = useState<string | null>(null);
  const [items, setItems] = useState<DraftRequisitionItem[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<Record<string, ItemFieldErrors>>({});

  const { data } = useQuery<{ programs: ProgramRecord[] }>(GET_PROGRAMS, {
    fetchPolicy: 'network-only',
  });
  const programOptions = data?.programs || [];

  const selectedProgram = useMemo(
    () => programOptions.find((p) => p.id === projectYearId) || null,
    [programOptions, projectYearId]
  );

  const isAdminProgram = selectedProgram?.type === 'Admin';

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

  // Admin-type programs have exactly one hidden outcome/output pair (created by
  // the server). Skip asking the user to pick them - auto-select so the flow
  // is just Program -> Activity.
  useEffect(() => {
    if (!isAdminProgram) return;
    const hiddenOutcomeId = outcomeOptions[0]?.id || '';
    if (hiddenOutcomeId && hiddenOutcomeId !== outcomeId) setOutcomeId(hiddenOutcomeId);
  }, [isAdminProgram, outcomeOptions, outcomeId]);

  useEffect(() => {
    if (!isAdminProgram) return;
    const hiddenOutputId = outputOptions[0]?.id || '';
    if (hiddenOutputId && hiddenOutputId !== outputId) setOutputId(hiddenOutputId);
  }, [isAdminProgram, outputOptions, outputId]);

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
    setErrors({});
    setItemErrors({});
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
    // clear the "add at least one line" error once a line is added
    setErrors((prev) => ({ ...prev, items: undefined }));
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
    // clear that specific field's error as the user edits it
    if (field === 'quantity' || field === 'frequency' || field === 'unitCost' || field === 'units') {
      setItemErrors((prev) => {
        if (!prev[id]?.[field as keyof ItemFieldErrors]) return prev;
        return { ...prev, [id]: { ...prev[id], [field]: undefined } };
      });
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.budgetLineId !== id));
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.frequency * item.unitCost, 0),
    [items]
  );

  const validate = (): { fieldErrors: FieldErrors; lineErrors: Record<string, ItemFieldErrors>; hasErrors: boolean } => {
    const fieldErrors: FieldErrors = {};
    const lineErrors: Record<string, ItemFieldErrors> = {};

    if (!projectYearId) fieldErrors.projectYearId = 'Program is required.';
    if (!isAdminProgram && !outcomeId) fieldErrors.outcomeId = 'Outcome is required.';
    if (!isAdminProgram && !outputId) fieldErrors.outputId = 'Output is required.';
    if (!activityId) fieldErrors.activityId = 'Activity is required.';
    if (!purpose.trim()) fieldErrors.purpose = 'Brief description is required.';
    if (!conceptNote && !conceptNotePreview) fieldErrors.conceptNote = 'Concept note is required.';

    if (!items.length) {
      fieldErrors.items = 'At least one budget line must be added.';
    } else {
      items.forEach((item) => {
        const lineErr: ItemFieldErrors = {};
        if (!item.quantity || item.quantity <= 0) lineErr.quantity = 'Required.';
        if (!item.frequency || item.frequency <= 0) lineErr.frequency = 'Required.';
        if (!item.unitCost || item.unitCost <= 0) lineErr.unitCost = 'Required.';
        if (!item.units || !item.units.trim()) lineErr.units = 'Required.';
        if (Object.keys(lineErr).length) lineErrors[item.budgetLineId] = lineErr;
      });
    }

    if (total <= 0 && !fieldErrors.items) fieldErrors.items = 'Budget line total must be greater than zero.';

    const hasErrors = Object.keys(fieldErrors).length > 0 || Object.keys(lineErrors).length > 0;
    return { fieldErrors, lineErrors, hasErrors };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { fieldErrors, lineErrors, hasErrors } = validate();
    setErrors(fieldErrors);
    setItemErrors(lineErrors);
    if (hasErrors) return;

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
              <label className="label-text font-medium">Program *</label>
              <select
                className={`select select-bordered w-full ${errors.projectYearId ? 'border-red-400' : ''}`}
                value={projectYearId}
                onChange={(e) => {
                  setProjectYearId(e.target.value);
                  setOutcomeId('');
                  setOutputId('');
                  setActivityId('');
                  setBudgetLineId('');
                  setErrors((prev) => ({ ...prev, projectYearId: undefined }));
                }}
              >
                <option value="">Select program</option>
                {programOptions.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
              {errors.projectYearId && <p className="text-xs text-red-600 mt-1">{errors.projectYearId}</p>}
            </div>
            {!isAdminProgram && (
              <div>
                <label className="label-text font-medium">Outcome *</label>
                <select
                  className={`select select-bordered w-full ${errors.outcomeId ? 'border-red-400' : ''}`}
                  value={outcomeId}
                  onChange={(e) => {
                    setOutcomeId(e.target.value);
                    setOutputId('');
                    setActivityId('');
                    setBudgetLineId('');
                    setErrors((prev) => ({ ...prev, outcomeId: undefined }));
                  }}
                  disabled={!projectYearId}
                >
                  <option value="">Select outcome</option>
                  {outcomeOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
                {errors.outcomeId && <p className="text-xs text-red-600 mt-1">{errors.outcomeId}</p>}
              </div>
            )}
            {!isAdminProgram && (
              <div>
                <label className="label-text font-medium">Output *</label>
                <select
                  className={`select select-bordered w-full ${errors.outputId ? 'border-red-400' : ''}`}
                  value={outputId}
                  onChange={(e) => {
                    setOutputId(e.target.value);
                    setActivityId('');
                    setBudgetLineId('');
                    setErrors((prev) => ({ ...prev, outputId: undefined }));
                  }}
                  disabled={!outcomeId}
                >
                  <option value="">Select output</option>
                  {outputOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
                {errors.outputId && <p className="text-xs text-red-600 mt-1">{errors.outputId}</p>}
              </div>
            )}
            <div>
              <label className="label-text font-medium">Activity *</label>
              <select
                className={`select select-bordered w-full ${errors.activityId ? 'border-red-400' : ''}`}
                value={activityId}
                onChange={(e) => {
                  setActivityId(e.target.value);
                  setBudgetLineId('');
                  setErrors((prev) => ({ ...prev, activityId: undefined }));
                }}
                disabled={isAdminProgram ? !projectYearId : !outputId}
              >
                <option value="">Select activity</option>
                {activityOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              {errors.activityId && <p className="text-xs text-red-600 mt-1">{errors.activityId}</p>}
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

            {errors.items && <p className="text-xs text-red-600">{errors.items}</p>}

            {!!items.length && (
              <div className="space-y-2">
                {items.map((item) => {
                  const lineErr = itemErrors[item.budgetLineId] || {};
                  return (
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
                        <div>
                          <input
                            className={`input input-bordered w-full ${lineErr.quantity ? 'border-red-400' : ''}`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.budgetLineId, 'quantity', e.target.value)}
                            placeholder="Qty"
                          />
                          {lineErr.quantity && <p className="text-xs text-red-600 mt-0.5">{lineErr.quantity}</p>}
                        </div>
                        <div>
                          <input
                            className={`input input-bordered w-full ${lineErr.frequency ? 'border-red-400' : ''}`}
                            type="number"
                            value={item.frequency}
                            onChange={(e) => updateItem(item.budgetLineId, 'frequency', e.target.value)}
                            placeholder="Frequency"
                          />
                          {lineErr.frequency && <p className="text-xs text-red-600 mt-0.5">{lineErr.frequency}</p>}
                        </div>
                        <div>
                          <input
                            className={`input input-bordered w-full ${lineErr.unitCost ? 'border-red-400' : ''}`}
                            type="number"
                            value={item.unitCost}
                            onChange={(e) => updateItem(item.budgetLineId, 'unitCost', e.target.value)}
                            placeholder="Unit cost"
                          />
                          {lineErr.unitCost && <p className="text-xs text-red-600 mt-0.5">{lineErr.unitCost}</p>}
                        </div>
                        <div>
                          <input
                            className={`input input-bordered w-full ${lineErr.units ? 'border-red-400' : ''}`}
                            value={item.units}
                            onChange={(e) => updateItem(item.budgetLineId, 'units', e.target.value)}
                            placeholder="Units"
                          />
                          {lineErr.units && <p className="text-xs text-red-600 mt-0.5">{lineErr.units}</p>}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Amount: {formatMoney(item.quantity * item.frequency * item.unitCost)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="label-text font-medium">Brief Description *</label>
            <textarea
              className={`textarea textarea-bordered w-full ${errors.purpose ? 'border-red-400' : ''}`}
              rows={3}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setErrors((prev) => ({ ...prev, purpose: undefined }));
              }}
              placeholder="Describe the request"
            />
            {errors.purpose && <p className="text-xs text-red-600 mt-1">{errors.purpose}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Concept Note *</label>
            <div className={`border-2 border-dashed rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative ${errors.conceptNote ? 'border-red-400' : ''}`}>
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer z-0"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setConceptNote(file);
                  if (file) {
                    setConceptNotePreview(URL.createObjectURL(file));
                    setErrors((prev) => ({ ...prev, conceptNote: undefined }));
                  }
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
            {errors.conceptNote && <p className="text-xs text-red-600 mt-1">{errors.conceptNote}</p>}
          </div>

          <div className={`rounded-lg border p-3 ${total <= 0 ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'}`}>
            <p className="text-xs text-slate-500">Total</p>
            <p className={`text-lg font-semibold ${total <= 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatMoney(total)}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => onOpenChange(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary px-8" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Requisition'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export { RequisitionFormSheet };