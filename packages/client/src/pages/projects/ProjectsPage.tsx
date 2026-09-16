import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useMutation, useQuery } from '@apollo/client/react';
import { Container } from '@/components/container';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAuthContext } from '@/auth/useAuthContext';
import { getPermissionsFromToken } from '@/utils/permissions';
import { toast } from 'sonner';
import { useDemo8Layout } from '@/layouts/demo8';
import {
  CREATE_PROGRAM,
  DELETE_PROGRAM,
  GET_PROGRAM_MANAGERS,
  GET_PROGRAMS,
  ProgramManager,
  ProgramRecord,
  SAVE_PROGRAM_STRUCTURE
} from '@/gql/programs';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(value || 0);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const cloneProgram = (program: ProgramRecord): ProgramRecord => structuredClone(program);

type BudgetLineDraft = {
  outcomeId: string;
  outputId: string;
  activityId: string;
  budgetLineId: string | null;
  name: string;
  quantity: string;
  frequency: string;
  unitPrice: string;
  units: string;
};

type PlanNodeEditor = {
  kind: 'outcome' | 'output' | 'activity';
  name: string;
  outcomeId: string;
  outputId?: string;
  activityId?: string;
};

const calculateBudgetLineTotal = (draft: Pick<BudgetLineDraft, 'quantity' | 'frequency' | 'unitPrice'>) => {
  const quantity = Number(draft.quantity || 0);
  const frequency = Number(draft.frequency || 0);
  const unitPrice = Number(draft.unitPrice || 0);
  return quantity * frequency * unitPrice ;
};

// Row-action kebab menu used at every hierarchy level below "Outcome".
// Keeping this as one shared component keeps the Edit/Remove affordance
// visually identical across Output / Activity / Budget Line rows.
const RowActionsMenu = ({
  onEdit,
  onRemove,
  editLabel = 'Edit',
  removeLabel = 'Remove'
}: {
  onEdit?: () => void;
  onRemove: () => void;
  editLabel?: string;
  removeLabel?: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="btn btn-icon btn-sm btn-light shrink-0"
        aria-label="Row actions"
      >
        <MoreVertical size={16} />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-36">
      {onEdit && (
        <DropdownMenuItem onClick={onEdit} className="gap-2 text-slate-700">
          <Pencil size={14} /> {editLabel}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onRemove} className="gap-2 text-rose-600 focus:text-rose-600">
        <Trash2 size={14} /> {removeLabel}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const ProjectsPage = () => {
  const { auth } = useAuthContext();
  const { setPageActions } = useDemo8Layout();
  const permissions = useMemo(() => getPermissionsFromToken(auth?.access_token), [auth?.access_token]);
  const canManagePrograms = Boolean(
    permissions.can_manage_programs ||
      permissions.can_create_programs ||
      permissions.can_edit_programs ||
      permissions.can_manage_users ||
      permissions.can_manage_roles
  );

  const { loading, error, data, refetch } = useQuery<{ programs: ProgramRecord[] }>(GET_PROGRAMS, {
    fetchPolicy: 'network-only'
  });
  const { data: managerData } = useQuery<{ programManagers: ProgramManager[] }>(GET_PROGRAM_MANAGERS, {
    fetchPolicy: 'network-only'
  });

  const [createProgram] = useMutation<{
    createProgram: { success: boolean; message?: string; program?: ProgramRecord | null };
  }, { input: Record<string, unknown> }>(CREATE_PROGRAM, {
    refetchQueries: [{ query: GET_PROGRAMS }, { query: GET_PROGRAM_MANAGERS }],
    awaitRefetchQueries: true
  });
  const [saveProgramStructure] = useMutation<{
    saveProgramStructure: { success: boolean; message?: string };
  }, { input: Record<string, unknown> }>(SAVE_PROGRAM_STRUCTURE, {
    refetchQueries: [{ query: GET_PROGRAMS }],
    awaitRefetchQueries: true
  });
  const [deleteProgram] = useMutation<{
    deleteProgram: { success: boolean; message?: string };
  }, { id: string }>(DELETE_PROGRAM, {
    refetchQueries: [{ query: GET_PROGRAMS }],
    awaitRefetchQueries: true
  });

  const programs = data?.programs || [];
  const managers = managerData?.programManagers || [];

  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [draftProgram, setDraftProgram] = useState<ProgramRecord | null>(null);
  const [structureDirty, setStructureDirty] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [createError, setCreateError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [programManagerId, setProgramManagerId] = useState('');
  const [programType, setProgramType] = useState<'Activity' | 'Admin'>('Activity');
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetLineDraft | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [nodeEditor, setNodeEditor] = useState<PlanNodeEditor | null>(null);

  // Inline "Add a brief program description..." affordance (Program header).
  // NOTE: SAVE_PROGRAM_STRUCTURE currently only persists the outcomes tree.
  // This updates the local draft (and flags structureDirty) so it rides
  // along with the next structure save; if description needs its own
  // mutation/field on the backend, swap the onSave handler below to call it.
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  const activityTotal = (activity: ProgramRecord['outcomes'][number]['outputs'][number]['activities'][number]) =>
    activity.budgetLines.reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
  const outputTotal = (output: ProgramRecord['outcomes'][number]['outputs'][number]) =>
    output.activities.reduce((sum, activity) => sum + activityTotal(activity), 0);
  const outcomeTotal = (outcome: ProgramRecord['outcomes'][number]) =>
    outcome.outputs.reduce((sum, output) => sum + outputTotal(output), 0);

  useEffect(() => {
    if (!programs.length) {
      setSelectedProgramId('');
      setDraftProgram(null);
      return;
    }

    if (!selectedProgramId || !programs.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    const selected = programs.find((program) => program.id === selectedProgramId) || null;
    setDraftProgram(selected ? cloneProgram(selected) : null);
    setStructureDirty(false);
    setEditingDescription(false);
    setDescriptionDraft(selected?.description || '');
    setSelectedOutcomeId(null);
    setSelectedOutputId(null);
    setSelectedActivityId(null);
  }, [programs, selectedProgramId]);

  const selectedProgram = draftProgram;
  // Admin-type programs store their activities under one hidden outcome/output
  // pair created by the server at program creation time; the UI never shows
  // that pair, it just reads/writes through it.
  const adminOutcome = selectedProgram?.type === 'Admin' ? selectedProgram.outcomes[0] : undefined;
  const adminOutput = adminOutcome?.outputs[0];
  const selectedOutcome = selectedProgram?.outcomes.find((item) => item.id === selectedOutcomeId);
  const selectedOutput = selectedOutcome?.outputs.find((item) => item.id === selectedOutputId);
  const selectedActivity = (selectedProgram?.type === 'Admin'
    ? adminOutput?.activities
    : selectedOutput?.activities
  )?.find((item) => item.id === selectedActivityId);

  const updateDraft = (updater: (program: ProgramRecord) => ProgramRecord) => {
    setDraftProgram((current) => {
      if (!current) return current;
      return updater(cloneProgram(current));
    });
    setStructureDirty(true);
  };

  const addOutcome = () => {
    if (!selectedProgram) return;
    updateDraft((program) => {
      program.outcomes.push({
        id: makeId('outcome'),
        name: `Outcome ${program.outcomes.length + 1}`,
        sortOrder: program.outcomes.length,
        outputs: []
      });
      return program;
    });
  };

  const addOutput = (outcomeId: string) => {
    updateDraft((program) => {
      const outcome = program.outcomes.find((item) => item.id === outcomeId);
      if (!outcome) return program;
      outcome.outputs.push({
        id: makeId('output'),
        name: `Output ${outcome.outputs.length + 1}`,
        sortOrder: outcome.outputs.length,
        activities: []
      });
      return program;
    });
  };

  const addActivity = (outcomeId: string, outputId: string) => {
    updateDraft((program) => {
      const activityParent = program.outcomes.find((item) => item.id === outcomeId)?.outputs.find((item) => item.id === outputId);
      if (!activityParent) return program;
      activityParent.activities.push({
        id: makeId('activity'),
        name: `Activity ${activityParent.activities.length + 1}`,
        sortOrder: activityParent.activities.length,
        budgetLines: []
      });
      return program;
    });
  };

  const addBudgetLine = (outcomeId: string, outputId: string, activityId: string) => {
    setBudgetDraft({
      outcomeId,
      outputId,
      activityId,
      budgetLineId: null,
      name: ``,
      quantity: '1',
      frequency: '1',
      unitPrice: '0',
      units: ''
    });
    setBudgetSheetOpen(true);
  };

  const renameOutcome = (outcomeId: string, name: string) => {
    updateDraft((program) => {
      const outcome = program.outcomes.find((item) => item.id === outcomeId);
      if (outcome) outcome.name = name;
      return program;
    });
  };

  const renameOutput = (outcomeId: string, outputId: string, name: string) => {
    updateDraft((program) => {
      const output = program.outcomes.find((item) => item.id === outcomeId)?.outputs.find((item) => item.id === outputId);
      if (output) output.name = name;
      return program;
    });
  };

  const renameActivity = (outcomeId: string, outputId: string, activityId: string, name: string) => {
    updateDraft((program) => {
      const activity = program.outcomes
        .find((item) => item.id === outcomeId)
        ?.outputs.find((item) => item.id === outputId)
        ?.activities.find((item) => item.id === activityId);
      if (activity) activity.name = name;
      return program;
    });
  };

  const handleSaveNodeName = () => {
    if (!nodeEditor?.name.trim()) return;

    if (nodeEditor.kind === 'outcome') {
      renameOutcome(nodeEditor.outcomeId, nodeEditor.name.trim());
    } else if (nodeEditor.kind === 'output' && nodeEditor.outputId) {
      renameOutput(nodeEditor.outcomeId, nodeEditor.outputId, nodeEditor.name.trim());
    } else if (
      nodeEditor.kind === 'activity' &&
      nodeEditor.outputId &&
      nodeEditor.activityId
    ) {
      renameActivity(
        nodeEditor.outcomeId,
        nodeEditor.outputId,
        nodeEditor.activityId,
        nodeEditor.name.trim()
      );
    }

    setNodeEditor(null);
  };

  const openBudgetLineSheet = (outcomeId: string, outputId: string, activityId: string, budgetLineId?: string) => {
    const existingBudgetLine = budgetLineId
      ? selectedProgram?.outcomes
          .find((item) => item.id === outcomeId)
          ?.outputs.find((item) => item.id === outputId)
          ?.activities.find((item) => item.id === activityId)
          ?.budgetLines.find((item) => item.id === budgetLineId)
      : null;

    setBudgetDraft({
      outcomeId,
      outputId,
      activityId,
      budgetLineId: existingBudgetLine?.id || null,
      name: existingBudgetLine?.name || 'Budget Line',
      quantity: String(existingBudgetLine?.quantity ?? 1),
      frequency: String(existingBudgetLine?.frequency ?? 1),
      unitPrice: String(existingBudgetLine?.unitPrice ?? 0),
      units: String(existingBudgetLine?.units ?? '')
    });
    setBudgetSheetOpen(true);
  };

  const handleSaveBudgetLine = () => {
    if (!budgetDraft) return;

    updateDraft((program) => {
      const outcome = program.outcomes.find((item) => item.id === budgetDraft.outcomeId);
      const output = outcome?.outputs.find((item) => item.id === budgetDraft.outputId);
      const activity = output?.activities.find((item) => item.id === budgetDraft.activityId);
      if (!activity) return program;

      const totalAmount = calculateBudgetLineTotal(budgetDraft);
      const existingBudgetLine = budgetDraft.budgetLineId
        ? activity.budgetLines.find((item) => item.id === budgetDraft.budgetLineId)
        : null;

      if (existingBudgetLine) {
        existingBudgetLine.name = budgetDraft.name.trim() || 'Budget Line';
        existingBudgetLine.quantity = Number(budgetDraft.quantity || 0);
        existingBudgetLine.frequency = Number(budgetDraft.frequency || 0);
        existingBudgetLine.unitPrice = Number(budgetDraft.unitPrice || 0);
        existingBudgetLine.units = budgetDraft.units || '';
        existingBudgetLine.totalAmount = totalAmount;
        existingBudgetLine.sortOrder = existingBudgetLine.sortOrder;
      } else {
        activity.budgetLines.push({
          id: makeId('line'),
          name: budgetDraft.name.trim() || 'Budget Line',
          quantity: Number(budgetDraft.quantity || 0),
          frequency: Number(budgetDraft.frequency || 0),
          unitPrice: Number(budgetDraft.unitPrice || 0),
          units: budgetDraft.units || '',
          totalAmount,
          sortOrder: activity.budgetLines.length
        });
      }

      return program;
    });

    setBudgetSheetOpen(false);
    setBudgetDraft(null);
  };

  const removeOutcome = (outcomeId: string) => {
    updateDraft((program) => {
      program.outcomes = program.outcomes.filter((item) => item.id !== outcomeId);
      return program;
    });
  };

  const removeOutput = (outcomeId: string, outputId: string) => {
    updateDraft((program) => {
      const outcome = program.outcomes.find((item) => item.id === outcomeId);
      if (!outcome) return program;
      outcome.outputs = outcome.outputs.filter((item) => item.id !== outputId);
      return program;
    });
  };

  const removeActivity = (outcomeId: string, outputId: string, activityId: string) => {
    updateDraft((program) => {
      const output = program.outcomes.find((item) => item.id === outcomeId)?.outputs.find((item) => item.id === outputId);
      if (!output) return program;
      output.activities = output.activities.filter((item) => item.id !== activityId);
      return program;
    });
  };

  const removeBudgetLine = (outcomeId: string, outputId: string, activityId: string, budgetLineId: string) => {
    updateDraft((program) => {
      const activity = program.outcomes
        .find((item) => item.id === outcomeId)
        ?.outputs.find((item) => item.id === outputId)
        ?.activities.find((item) => item.id === activityId);
      if (!activity) return program;
      activity.budgetLines = activity.budgetLines.filter((item) => item.id !== budgetLineId);
      return program;
    });
  };

  const handleOpenCreateProgram = useCallback(() => {
    setEditingProgramId(null);
    setProgramName('');
    setProgramDescription('');
    setBudgetAmount('');
    setProgramManagerId('');
    setProgramType('Activity');
    setCreateError('');
    setCreateOpen(true);
  }, []);

  useEffect(() => {
    if (!canManagePrograms) {
      setPageActions([]);
      return;
    }

    setPageActions([{ label: 'New Program', onClick: handleOpenCreateProgram, icon: 'plus' }]);
    return () => setPageActions([]);
  }, [canManagePrograms, handleOpenCreateProgram, setPageActions]);

  const handleOpenEditProgram = (program: ProgramRecord) => {
    setEditingProgramId(program.id);
    setProgramName(program.name);
    setProgramDescription(program.description || '');
    setBudgetAmount(String(program.budgetAmount ?? ''));
    setProgramManagerId(program.programManagerId || '');
    setProgramType(program.type || 'Activity');
    setCreateError('');
    setCreateOpen(true);
  };

  const handleDeleteProgram = async (program: ProgramRecord) => {
    if (!window.confirm(`Delete program "${program.name}"? This cannot be undone.`)) return;

    setDeletingProgramId(program.id);
    try {
      const response = await deleteProgram({ variables: { id: program.id } });
      if (!response.data?.deleteProgram?.success) {
        throw new Error(response.data?.deleteProgram?.message || 'Failed to delete program.');
      }
      toast.success('Program deleted successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete program.');
    } finally {
      setDeletingProgramId(null);
    }
  };

  const handleCreateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError('');

    if (!programName.trim()) {
      setCreateError('Program name is required.');
      return;
    }
    
    setCreatingProgram(true);
    try {
      const response = await createProgram({
        variables: {
          input: {
            id: editingProgramId || null,
            name: programName.trim(),
            description: programDescription.trim() || null,
            budgetAmount: Number(budgetAmount || 0),
            programManagerId: programManagerId || null,
            status: 'active',
            type: editingProgramId ? undefined : programType
          }
        }
      });

      console.log('createProgram response:', response);

      const savedProgram = response.data?.createProgram?.program;
      const wasEdit = Boolean(editingProgramId);
      await refetch();
      setCreateOpen(false);
      setEditingProgramId(null);
      setProgramName('');
      setProgramDescription('');
      setBudgetAmount('');
      setProgramManagerId('');
      setProgramType('Activity');

      if (savedProgram?.id) {
        setSelectedProgramId(savedProgram.id);
      }

      toast.success(wasEdit ? 'Program updated successfully.' : 'Program created successfully.');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to save program.');
    } finally {
      setCreatingProgram(false);
    }
  };

  const handleSaveStructure = async () => {
    if (!selectedProgram) return;

    setSavingStructure(true);
    setSaveError('');

    try {
      const response = await saveProgramStructure({
        variables: {
          input: {
            programId: selectedProgram.id,
            outcomes: selectedProgram.outcomes.map((outcome, outcomeIndex) => ({
              id: outcome.id.startsWith('outcome-') ? null : outcome.id,
              name: outcome.name,
              sortOrder: outcomeIndex,
              outputs: outcome.outputs.map((output, outputIndex) => ({
                id: output.id.startsWith('output-') ? null : output.id,
                name: output.name,
                sortOrder: outputIndex,
                activities: output.activities.map((activity, activityIndex) => ({
                  id: activity.id.startsWith('activity-') ? null : activity.id,
                  name: activity.name,
                  sortOrder: activityIndex,
                  budgetLines: activity.budgetLines.map((budgetLine, budgetLineIndex) => ({
                    id: budgetLine.id.startsWith('line-') ? null : budgetLine.id,
                    name: budgetLine.name,
                    quantity: budgetLine.quantity,
                    frequency: budgetLine.frequency,
                    unitPrice: budgetLine.unitPrice,
                    units: budgetLine.units,
                    totalAmount: budgetLine.totalAmount,
                    sortOrder: budgetLineIndex
                  }))
                }))
              }))
            }))
          }
        }
      });

      if (!response.data?.saveProgramStructure?.success) {
        throw new Error(response.data?.saveProgramStructure?.message || 'Failed to save program structure.');
      }

      await refetch();
      setStructureDirty(false);
      toast.success('Program structure saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message: 'Failed to save program structure.' );
      // setSaveError(error instanceof Error ? error.message : 'Failed to save program structure.');
    } finally {
      setSavingStructure(false);
    }
  };

  const handleSaveDescription = () => {
    updateDraft((program) => {
      program.description = descriptionDraft.trim();
      return program;
    });
    setEditingDescription(false);
  };

  return (
    <Container>
      <div className="py-4 sm:py-5 lg:py-6">
        {loading ? (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card p-4 lg:col-span-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
            <div className="card p-4 lg:col-span-2 space-y-4">
              <Skeleton className="h-6 w-72" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Failed to load programs.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            <aside className="card p-4 lg:col-span-1 space-y-2">
              <div className="flex min-h-8 items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Programs</h3>
              </div>

              {programs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <p>No programs have been created yet.</p>
                </div>
              ) : (
                programs.map((program) => (
                  <div
                    key={program.id}
                    onClick={() => setSelectedProgramId(program.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left cursor-pointer flex items-start justify-between gap-2 ${selectedProgram?.id === program.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{program.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatMoney(program.budgetAmount)} · {program.programManagerName || 'Unassigned'}
                      </p>
                    </div>
                    {canManagePrograms && (
                      <div onClick={(event) => event.stopPropagation()} className="shrink-0">
                        <RowActionsMenu
                          editLabel="Edit"
                          removeLabel={deletingProgramId === program.id ? 'Deleting...' : 'Delete'}
                          onEdit={() => handleOpenEditProgram(program)}
                          onRemove={() => handleDeleteProgram(program)}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </aside>

            <section className="card overflow-hidden lg:col-span-2">
              {!selectedProgram ? (
                <div className="p-6">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    Select a program to view its plan.
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-slate-200 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold tracking-[-0.02em] text-[#172550]">
                            {selectedProgram.name}
                          </h2>
                          <span className="rounded-full bg-[#e9f8fc] px-2.5 py-1 text-[11px] font-bold text-[#227f9e]">
                            {selectedProgram.type === 'Admin' ? 'Administrative program' : 'Standard program'}
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold capitalize text-emerald-700">
                            {selectedProgram.status}
                          </span>
                        </div>

                        {editingDescription ? (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              autoFocus
                              className="input flex-1"
                              value={descriptionDraft}
                              placeholder="Add a short description"
                              onChange={(event) => setDescriptionDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') handleSaveDescription();
                                if (event.key === 'Escape') {
                                  setDescriptionDraft(selectedProgram.description || '');
                                  setEditingDescription(false);
                                }
                              }}
                            />
                            <div className="flex gap-2">
                              <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveDescription}>Save</button>
                              <button
                                type="button"
                                className="btn btn-sm btn-light"
                                onClick={() => {
                                  setDescriptionDraft(selectedProgram.description || '');
                                  setEditingDescription(false);
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-2 flex max-w-2xl items-center gap-1.5 text-left text-sm text-slate-500 outline-none hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#2aaed3]"
                            onClick={() => {
                              setDescriptionDraft(selectedProgram.description || '');
                              setEditingDescription(true);
                            }}
                          >
                            <span>{selectedProgram.description || 'Add a short program description'}</span>
                            <Pencil size={12} className="shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Total budget</dt>
                        <dd className="mt-1 text-sm font-bold text-slate-800">{formatMoney(selectedProgram.budgetAmount)}</dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Program manager</dt>
                        <dd className="mt-1 truncate text-sm font-bold text-slate-800">{selectedProgram.programManagerName || 'Not assigned'}</dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Plan summary</dt>
                        <dd className="mt-1 text-sm font-bold text-slate-800">
                          {selectedProgram.type === 'Admin'
                            ? `${adminOutput?.activities.length || 0} activities`
                            : `${selectedProgram.outcomes.length} outcomes`}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="p-5 sm:p-6">
                    <nav aria-label="Program plan location" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-[#227f9e] hover:bg-[#e9f8fc]"
                        onClick={() => {
                          setSelectedOutcomeId(null);
                          setSelectedOutputId(null);
                          setSelectedActivityId(null);
                        }}
                      >
                        Program plan
                      </button>
                      {selectedProgram.type !== 'Admin' && selectedOutcome && (
                        <>
                          <ChevronRight className="size-3.5 text-slate-300" />
                          <button
                            type="button"
                            className="max-w-48 truncate rounded-md px-2 py-1 text-[#227f9e] hover:bg-[#e9f8fc]"
                            onClick={() => {
                              setSelectedOutputId(null);
                              setSelectedActivityId(null);
                            }}
                          >
                            {selectedOutcome.name}
                          </button>
                        </>
                      )}
                      {selectedProgram.type !== 'Admin' && selectedOutput && (
                        <>
                          <ChevronRight className="size-3.5 text-slate-300" />
                          <button
                            type="button"
                            className="max-w-48 truncate rounded-md px-2 py-1 text-[#227f9e] hover:bg-[#e9f8fc]"
                            onClick={() => setSelectedActivityId(null)}
                          >
                            {selectedOutput.name}
                          </button>
                        </>
                      )}
                      {selectedActivity && (
                        <>
                          <ChevronRight className="size-3.5 text-slate-300" />
                          <span className="max-w-48 truncate rounded-md px-2 py-1 text-slate-500">{selectedActivity.name}</span>
                        </>
                      )}
                    </nav>

                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2aaed3]">
                          {selectedActivity ? 'Budget level' : selectedOutput ? 'Activity level' : selectedOutcome ? 'Output level' : selectedProgram.type === 'Admin' ? 'Activity level' : 'Outcome level'}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-[#172550]">
                          {selectedActivity ? 'Budget items' : selectedOutput ? 'Activities' : selectedOutcome ? 'Outputs' : selectedProgram.type === 'Admin' ? 'Activities' : 'Outcomes'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedActivity
                            ? `Costs required to complete ${selectedActivity.name}.`
                            : selectedOutput
                              ? `The work needed to deliver ${selectedOutput.name}.`
                              : selectedOutcome
                                ? `The measurable results that support ${selectedOutcome.name}.`
                                : selectedProgram.type === 'Admin'
                                  ? 'The work carried out under this administrative program.'
                                  : 'The changes this program is expected to achieve.'}
                        </p>
                      </div>

                      {canManagePrograms && !selectedActivity && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={selectedProgram.type === 'Admin' && (!adminOutcome || !adminOutput)}
                          onClick={() => {
                            if (selectedOutput && selectedOutcome) addActivity(selectedOutcome.id, selectedOutput.id);
                            else if (selectedOutcome) addOutput(selectedOutcome.id);
                            else if (selectedProgram.type === 'Admin' && adminOutcome && adminOutput) addActivity(adminOutcome.id, adminOutput.id);
                            else addOutcome();
                          }}
                        >
                          {selectedOutput
                            ? `Add activity`
                            : selectedOutcome
                              ? 'Add output'
                              : selectedProgram.type === 'Admin'
                                ? 'Add activity'
                                : 'Add outcome'}
                        </button>
                      )}

                      {canManagePrograms && selectedActivity && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            if (selectedProgram.type === 'Admin' && adminOutcome && adminOutput) {
                              addBudgetLine(adminOutcome.id, adminOutput.id, selectedActivity.id);
                            } else if (selectedOutcome && selectedOutput) {
                              addBudgetLine(selectedOutcome.id, selectedOutput.id, selectedActivity.id);
                            }
                          }}
                        >
                          Add budget item
                        </button>
                      )}
                    </div>

                    {!adminOutcome && selectedProgram.type === 'Admin' ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        This program is missing its activity container. Contact support to restore it.
                      </div>
                    ) : selectedActivity ? (
                      <div className="space-y-3">
                        {selectedActivity.budgetLines.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">
                            No budget items have been added to this activity.
                          </div>
                        ) : (
                          selectedActivity.budgetLines.map((budgetLine) => (
                            <div key={budgetLine.id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{budgetLine.name}</p>
                                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                                    <span><strong className="font-semibold text-slate-700">Quantity:</strong> {budgetLine.quantity}</span>
                                    <span><strong className="font-semibold text-slate-700">Frequency:</strong> {budgetLine.frequency}</span>
                                    <span><strong className="font-semibold text-slate-700">Unit cost:</strong> {formatMoney(budgetLine.unitPrice)}</span>
                                    {budgetLine.units && <span><strong className="font-semibold text-slate-700">Unit:</strong> {budgetLine.units}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                                    <p className="text-sm font-bold text-[#172550]">{formatMoney(budgetLine.totalAmount)}</p>
                                  </div>
                                  {canManagePrograms && (
                                    <RowActionsMenu
                                      editLabel="Edit budget item"
                                      onEdit={() => {
                                        if (selectedProgram.type === 'Admin' && adminOutcome && adminOutput) {
                                          openBudgetLineSheet(adminOutcome.id, adminOutput.id, selectedActivity.id, budgetLine.id);
                                        } else if (selectedOutcome && selectedOutput) {
                                          openBudgetLineSheet(selectedOutcome.id, selectedOutput.id, selectedActivity.id, budgetLine.id);
                                        }
                                      }}
                                      onRemove={() => {
                                        if (selectedProgram.type === 'Admin' && adminOutcome && adminOutput) {
                                          removeBudgetLine(adminOutcome.id, adminOutput.id, selectedActivity.id, budgetLine.id);
                                        } else if (selectedOutcome && selectedOutput) {
                                          removeBudgetLine(selectedOutcome.id, selectedOutput.id, selectedActivity.id, budgetLine.id);
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : selectedOutput && selectedOutcome ? (
                      <div className="space-y-3">
                        {selectedOutput.activities.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">No activities have been added to this output.</div>
                        ) : selectedOutput.activities.map((activity, index) => (
                          <div key={activity.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedActivityId(activity.id)}>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-purple-500">Activity {index + 1}</p>
                              <p className="mt-1 truncate text-sm font-bold text-slate-900">{activity.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{activity.budgetLines.length} budget items · {formatMoney(activityTotal(activity))}</p>
                            </button>
                            {canManagePrograms && (
                              <RowActionsMenu
                                onEdit={() => setNodeEditor({ kind: 'activity', name: activity.name, outcomeId: selectedOutcome.id, outputId: selectedOutput.id, activityId: activity.id })}
                                onRemove={() => removeActivity(selectedOutcome.id, selectedOutput.id, activity.id)}
                              />
                            )}
                            <ChevronRight className="size-4 shrink-0 text-slate-300" />
                          </div>
                        ))}
                      </div>
                    ) : selectedOutcome ? (
                      <div className="space-y-3">
                        {selectedOutcome.outputs.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">No outputs have been added to this outcome.</div>
                        ) : selectedOutcome.outputs.map((output, index) => (
                          <div key={output.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setSelectedOutputId(output.id); setSelectedActivityId(null); }}>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">Output {index + 1}</p>
                              <p className="mt-1 truncate text-sm font-bold text-slate-900">{output.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{output.activities.length} activities · {formatMoney(outputTotal(output))}</p>
                            </button>
                            {canManagePrograms && (
                              <RowActionsMenu
                                onEdit={() => setNodeEditor({ kind: 'output', name: output.name, outcomeId: selectedOutcome.id, outputId: output.id })}
                                onRemove={() => removeOutput(selectedOutcome.id, output.id)}
                              />
                            )}
                            <ChevronRight className="size-4 shrink-0 text-slate-300" />
                          </div>
                        ))}
                      </div>
                    ) : selectedProgram.type === 'Admin' && adminOutcome && adminOutput ? (
                      <div className="space-y-3">
                        {adminOutput.activities.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">No activities have been added to this program.</div>
                        ) : adminOutput.activities.map((activity, index) => (
                          <div key={activity.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedActivityId(activity.id)}>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-purple-500">Activity {index + 1}</p>
                              <p className="mt-1 truncate text-sm font-bold text-slate-900">{activity.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{activity.budgetLines.length} budget items · {formatMoney(activityTotal(activity))}</p>
                            </button>
                            {canManagePrograms && (
                              <RowActionsMenu
                                onEdit={() => setNodeEditor({ kind: 'activity', name: activity.name, outcomeId: adminOutcome.id, outputId: adminOutput.id, activityId: activity.id })}
                                onRemove={() => removeActivity(adminOutcome.id, adminOutput.id, activity.id)}
                              />
                            )}
                            <ChevronRight className="size-4 shrink-0 text-slate-300" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProgram.outcomes.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">No outcomes have been added to this program.</div>
                        ) : selectedProgram.outcomes.map((outcome, index) => {
                          const activityCount = outcome.outputs.reduce((total, output) => total + output.activities.length, 0);
                          return (
                            <div key={outcome.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setSelectedOutcomeId(outcome.id); setSelectedOutputId(null); setSelectedActivityId(null); }}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2aaed3]">Outcome {index + 1}</p>
                                <p className="mt-1 truncate text-sm font-bold text-slate-900">{outcome.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{outcome.outputs.length} outputs · {activityCount} activities · {formatMoney(outcomeTotal(outcome))}</p>
                              </button>
                              {canManagePrograms && (
                                <RowActionsMenu
                                  onEdit={() => setNodeEditor({ kind: 'outcome', name: outcome.name, outcomeId: outcome.id })}
                                  onRemove={() => removeOutcome(outcome.id)}
                                />
                              )}
                              <ChevronRight className="size-4 shrink-0 text-slate-300" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={clsx(
                      'mt-6 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                      structureDirty ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                    )}>
                      <div>
                        <p className={clsx('text-sm font-bold', structureDirty ? 'text-amber-900' : 'text-slate-700')}>
                          {structureDirty ? 'You have unsaved changes' : 'All plan changes are saved'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {structureDirty ? 'Save before leaving this program.' : 'Edit or add an item to update this plan.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary shrink-0"
                        onClick={handleSaveStructure}
                        disabled={!structureDirty || savingStructure}
                      >
                        {savingStructure ? 'Saving changes…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(nodeEditor)}
        onOpenChange={(open) => {
          if (!open) setNodeEditor(null);
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <DialogTitle className="text-base font-semibold capitalize text-slate-900">
              Edit {nodeEditor?.kind}
            </DialogTitle>
            <DialogDescription>
              Use a short, clear name that team members will recognize.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <div>
              <label className="form-label capitalize text-slate-900">
                {nodeEditor?.kind} name
              </label>
              <input
                autoFocus
                className="input"
                value={nodeEditor?.name || ''}
                onChange={(event) =>
                  setNodeEditor((current) =>
                    current ? { ...current, name: event.target.value } : current
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSaveNodeName();
                  if (event.key === 'Escape') setNodeEditor(null);
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-light" onClick={() => setNodeEditor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!nodeEditor?.name.trim()}
                onClick={handleSaveNodeName}
              >
                Save changes
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {editingProgramId ? 'Edit Program' : 'Create Program'}
            </DialogTitle>
          </DialogHeader>

          <form className="p-5 space-y-4" onSubmit={handleCreateProgram}>
            {createError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</div>}

            <div>
              <label className="form-label text-slate-900">Program Name</label>
              <input className="input" value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="e.g. Inclusive livelihoods program" />
            </div>

            <div>
              <label className="form-label text-slate-900">Description</label>
              <textarea className="textarea" rows={3} value={programDescription} onChange={(event) => setProgramDescription(event.target.value)} placeholder="Describe the program." />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="form-label text-slate-900">Budget Amount</label>
                <input className="input" type="number" min={0} value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="form-label text-slate-900">Program Manager</label>
                <select className="select" value={programManagerId} onChange={(event) => setProgramManagerId(event.target.value)}>
                  <option value="">Select manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} {manager.role ? `(${manager.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label text-slate-900">Program Type</label>
              {editingProgramId ? (
                <input
                  className="input"
                  value={programType === 'Admin' ? 'Administrative program' : 'Standard program'}
                  readOnly
                  title="Program type is locked after creation."
                />
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="programType"
                      className="mt-1"
                      checked={programType === 'Activity'}
                      onChange={() => setProgramType('Activity')}
                    />
                    <span>
                      <span className="font-medium text-slate-900">Standard program</span> — outcomes, outputs, activities, and budget items.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="programType"
                      className="mt-1"
                      checked={programType === 'Admin'}
                      onChange={() => setProgramType('Admin')}
                    />
                    <span>
                      <span className="font-medium text-slate-900">Administrative program</span> — activities and budget items only.
                    </span>
                  </label>
                </div>
              )}
            </div>

            {!editingProgramId && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                After creating the program, you can build its plan from the program workspace.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingProgramId(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creatingProgram}>
                {creatingProgram ? 'Saving...' : editingProgramId ? 'Save Changes' : 'Create Program'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={budgetSheetOpen} onOpenChange={setBudgetSheetOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-y-auto max-h-[90vh]">
          <div className="p-6 border-b bg-slate-50/50">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">Budget item</DialogTitle>
              <DialogDescription>
                Enter quantity, frequency, unit price, and units. The total is calculated automatically.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            {budgetDraft && (
              <>
                <div>
                  <label className="form-label text-slate-900">Item name</label>
                  <input
                    className="input"
                    value={budgetDraft.name}
                    onChange={(event) => setBudgetDraft((current) => current ? { ...current, name: event.target.value } : current)}
                    placeholder="Budget item name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-slate-900">Quantity</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="any"
                      value={budgetDraft.quantity}
                      onChange={(event) => setBudgetDraft((current) => current ? { ...current, quantity: event.target.value } : current)}
                    />
                  </div>
                  <div>
                    <label className="form-label text-slate-900">Frequency</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="any"
                      value={budgetDraft.frequency}
                      onChange={(event) => setBudgetDraft((current) => current ? { ...current, frequency: event.target.value } : current)}
                    />
                  </div>
                  <div>
                    <label className="form-label text-slate-900">Unit Price</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="any"
                      value={budgetDraft.unitPrice}
                      onChange={(event) => setBudgetDraft((current) => current ? { ...current, unitPrice: event.target.value } : current)}
                    />
                  </div>
                  <div>
                    <label className="form-label text-slate-900">Units</label>
                    <input
                      className="input"
                      value={budgetDraft.units}
                      onChange={(event) => setBudgetDraft((current) => current ? { ...current, units: event.target.value } : current)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Calculated Total</p>
                  <p className="text-xl font-semibold text-slate-900">{formatMoney(calculateBudgetLineTotal(budgetDraft))}</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="btn btn-light" onClick={() => setBudgetSheetOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveBudgetLine}>
                    Save budget item
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default ProjectsPage;
