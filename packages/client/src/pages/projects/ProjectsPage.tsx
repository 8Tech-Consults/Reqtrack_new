import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2, ArrowRight, ChevronsRight } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Container } from '@/components/container';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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
import { StatCard } from './components/StatCard';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
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

  const [createProgram] = useMutation(CREATE_PROGRAM, {
    refetchQueries: [{ query: GET_PROGRAMS }, { query: GET_PROGRAM_MANAGERS }],
    awaitRefetchQueries: true
  });
  const [saveProgramStructure] = useMutation(SAVE_PROGRAM_STRUCTURE, {
    refetchQueries: [{ query: GET_PROGRAMS }],
    awaitRefetchQueries: true
  });
  const [deleteProgram] = useMutation(DELETE_PROGRAM, {
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
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetLineDraft | null>(null);
  const [collapsedOutcomes, setCollapsedOutcomes] = useState<Set<string>>(new Set());
  const [collapsedOutputs, setCollapsedOutputs] = useState<Set<string>>(new Set());
  const [collapsedActivities, setCollapsedActivities] = useState<Set<string>>(new Set());

  // Inline "Add a brief program description..." affordance (Program header).
  // NOTE: SAVE_PROGRAM_STRUCTURE currently only persists the outcomes tree.
  // This updates the local draft (and flags structureDirty) so it rides
  // along with the next structure save; if description needs its own
  // mutation/field on the backend, swap the onSave handler below to call it.
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  const toggleId = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOutcome = (outcomeId: string) => toggleId(setCollapsedOutcomes, outcomeId);
  const toggleOutput = (outputId: string) => toggleId(setCollapsedOutputs, outputId);
  const toggleActivity = (activityId: string) => toggleId(setCollapsedActivities, activityId);

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
  }, [programs, selectedProgramId]);

  const selectedProgram = draftProgram;

  const stats = useMemo(() => {
    const totals = programs.reduce(
      (acc, program) => {
        acc.budget += Number(program.budgetAmount || 0);
        acc.outcomes += program.outcomes.length;
        for (const outcome of program.outcomes) {
          acc.outputs += outcome.outputs.length;
          for (const output of outcome.outputs) {
            acc.activities += output.activities.length;
            for (const activity of output.activities) {
              acc.budgetLines += activity.budgetLines.length;
            }
          }
        }
        return acc;
      },
      { budget: 0, outcomes: 0, outputs: 0, activities: 0, budgetLines: 0 }
    );

    return { programs: programs.length, ...totals };
  }, [programs]);

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

  const renameBudgetLine = (outcomeId: string, outputId: string, activityId: string, budgetLineId: string, name: string) => {
    updateDraft((program) => {
      const budgetLine = program.outcomes
        .find((item) => item.id === outcomeId)
        ?.outputs.find((item) => item.id === outputId)
        ?.activities.find((item) => item.id === activityId)
        ?.budgetLines.find((item) => item.id === budgetLineId);
      if (budgetLine) budgetLine.name = name;
      return program;
    });
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

  const handleOpenCreateProgram = () => {
    setEditingProgramId(null);
    setProgramName('');
    setProgramDescription('');
    setBudgetAmount('');
    setProgramManagerId('');
    setCreateError('');
    setCreateOpen(true);
  };

  const handleOpenEditProgram = (program: ProgramRecord) => {
    setEditingProgramId(program.id);
    setProgramName(program.name);
    setProgramDescription(program.description || '');
    setBudgetAmount(String(program.budgetAmount ?? ''));
    setProgramManagerId(program.programManagerId || '');
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
            id: editingProgramId || undefined,
            name: programName.trim(),
            description: programDescription.trim() || null,
            budgetAmount: Number(budgetAmount || 0),
            programManagerId: programManagerId || null,
            status: 'active'
          }
        }
      });

      const savedProgram = response.data?.createProgram?.program;
      const wasEdit = Boolean(editingProgramId);
      await refetch();
      setCreateOpen(false);
      setEditingProgramId(null);
      setProgramName('');
      setProgramDescription('');
      setBudgetAmount('');
      setProgramManagerId('');

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
      <div className="py-6 lg:py-8 grid gap-5 lg:gap-7.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-slate-900">Programs Module</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create programs first, assign a manager and budget, then build outcomes, outputs, activities, and budget lines.
            </p>
          </div>

          {canManagePrograms && (
            <button type="button" className="btn btn-primary" onClick={handleOpenCreateProgram}>
              New Program
            </button>
          )}
        </div>

        {/* <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Programs" value={stats.programs} />
          <StatCard label="Total Budget" value={formatMoney(stats.budget)} />
          <StatCard label="Outcomes" value={stats.outcomes} />
          <StatCard label="Activities" value={stats.activities} />
          <StatCard label="Budget Lines" value={stats.budgetLines} />
        </div> */}

        <Separator className="bg-slate-200" />

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
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Programs</h3>
                {canManagePrograms && (
                  <button type="button" className="btn btn-sm btn-light" onClick={handleOpenCreateProgram}>
                    Create Program
                  </button>
                )}
              </div>

              {programs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-3">
                  <p>No programs have been created yet.</p>
                  {canManagePrograms && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleOpenCreateProgram}>
                      Create First Program
                    </button>
                  )}
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

            <section className="card p-4 lg:col-span-2 space-y-4">
              {!selectedProgram ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm text-slate-500">Select a program to manage its hierarchy.</p>
                  {canManagePrograms && (
                    <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                      Create Program
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <h2 className="text-lg font-semibold text-slate-900">{selectedProgram.name}</h2>

                      {editingDescription ? (
                        <div className="mt-1 flex items-start gap-2">
                          <input
                            autoFocus
                            className="input flex-1"
                            value={descriptionDraft}
                            placeholder="Add a brief program description..."
                            onChange={(event) => setDescriptionDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleSaveDescription();
                              if (event.key === 'Escape') {
                                setDescriptionDraft(selectedProgram.description || '');
                                setEditingDescription(false);
                              }
                            }}
                          />
                          <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveDescription}>
                            Save
                          </button>
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
                      ) : (
                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
                          onClick={() => {
                            setDescriptionDraft(selectedProgram.description || '');
                            setEditingDescription(true);
                          }}
                        >
                          <span>{selectedProgram.description || 'Add a brief program description...'}</span>
                          <Pencil size={12} className="shrink-0 text-slate-400" />
                        </button>
                      )}
                    </div>
                    <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">{selectedProgram.status}</span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label text-slate-900">Program Budget</label>
                      <input className="input" value={formatMoney(selectedProgram.budgetAmount)} readOnly />
                    </div>
                    <div>
                      <label className="form-label text-slate-900">Program Manager</label>
                      <input className="input" value={selectedProgram.programManagerName || 'Unassigned'} readOnly />
                    </div>
                    
                  </div>

                  {/* {saveError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</div>} */}

                  {/* <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Create the program first, then manually add outcomes, outputs, activities, and budget lines below.
                  </div> */}

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {selectedProgram.outcomes.map((outcome) => {
                      const outcomeCollapsed = collapsedOutcomes.has(outcome.id);
                      return (
                        <div key={outcome.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-icon btn-sm btn-light shrink-0"
                              onClick={() => toggleOutcome(outcome.id)}
                              aria-label={outcomeCollapsed ? 'Expand outcome' : 'Collapse outcome'}
                            >
                              {outcomeCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <input className="input flex-1 min-w-[160px] font-medium" value={outcome.name} onChange={(event) => renameOutcome(outcome.id, event.target.value)} />
                            <input
                              className="input w-40 shrink-0"
                              value={formatMoney(outcomeTotal(outcome))}
                              readOnly
                              title="Total budget for this outcome"
                            />
                            <RowActionsMenu onRemove={() => removeOutcome(outcome.id)} />
                          </div>

                          {!outcomeCollapsed && (
                            <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                              {outcome.outputs.map((output) => {
                                const outputCollapsed = collapsedOutputs.has(output.id);
                                return (
                                  <div key={output.id} className="rounded-lg border border-blue-200 bg-blue-50/40 p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        className="btn btn-icon btn-sm btn-light shrink-0"
                                        onClick={() => toggleOutput(output.id)}
                                        aria-label={outputCollapsed ? 'Expand output' : 'Collapse output'}
                                      >
                                        {outputCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                      </button>
                                      <ArrowRight size={14} className="text-blue-500 shrink-0" />
                                      <input className="input flex-1 min-w-[160px]" value={output.name} onChange={(event) => renameOutput(outcome.id, output.id, event.target.value)} />
                                      <input
                                        className="input w-40 shrink-0"
                                        value={formatMoney(outputTotal(output))}
                                        readOnly
                                        title="Total budget for this output"
                                      />
                                      <RowActionsMenu onRemove={() => removeOutput(outcome.id, output.id)} />
                                    </div>

                                    {!outputCollapsed && (
                                      <div className="mt-2 space-y-2 pl-2 border-l-2 border-blue-200">
                                        {output.activities.map((activity) => {
                                          const activityCollapsed = collapsedActivities.has(activity.id);
                                          return (
                                            <div key={activity.id} className="rounded-lg border border-purple-200 bg-purple-50/40 p-2">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                  type="button"
                                                  className="btn btn-icon btn-sm btn-light shrink-0"
                                                  onClick={() => toggleActivity(activity.id)}
                                                  aria-label={activityCollapsed ? 'Expand activity' : 'Collapse activity'}
                                                >
                                                  {activityCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                <span className="flex items-center text-purple-500 shrink-0">
                                                  <ChevronsRight size={14} />
                                                </span>
                                                <input
                                                  className="input flex-1 min-w-[160px]"
                                                  value={activity.name}
                                                  onChange={(event) => renameActivity(outcome.id, output.id, activity.id, event.target.value)}
                                                />
                                                <input
                                                  className="input w-40 shrink-0"
                                                  value={formatMoney(activityTotal(activity))}
                                                  readOnly
                                                  title="Total budget for this activity"
                                                />
                                                <RowActionsMenu onRemove={() => removeActivity(outcome.id, output.id, activity.id)} />
                                              </div>

                                              {!activityCollapsed && (
                                                <div className="mt-2 space-y-2 pl-2 border-l-2 border-purple-200">
                                                  {activity.budgetLines.map((budgetLine) => (
                                                    <div key={budgetLine.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
                                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-start gap-2 min-w-0">
                                                          <span className="flex items-center text-emerald-500 shrink-0 mt-0.5">
                                                            <ChevronsRight size={14} />
                                                            <ChevronsRight size={14} className="-ml-2" />
                                                          </span>
                                                          <div className="min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 truncate">{budgetLine.name}</p>
                                                            <p className="text-xs text-slate-500">
                                                              {budgetLine.quantity} x {budgetLine.frequency} x {formatMoney(budgetLine.unitPrice)} = {formatMoney(budgetLine.totalAmount)} {budgetLine.units}
                                                            </p>
                                                          </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                          <span className="text-sm font-semibold text-slate-900">{formatMoney(budgetLine.totalAmount)}</span>
                                                          <RowActionsMenu
                                                            editLabel="Edit"
                                                            onEdit={() => openBudgetLineSheet(outcome.id, output.id, activity.id, budgetLine.id)}
                                                            onRemove={() => removeBudgetLine(outcome.id, output.id, activity.id, budgetLine.id)}
                                                          />
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                  <button type="button" className="btn btn-sm btn-light" onClick={() => addBudgetLine(outcome.id, output.id, activity.id)}>
                                                    Add Budget Line
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        <button type="button" className="btn btn-sm btn-light" onClick={() => addActivity(outcome.id, output.id)}>
                                          Add Activity
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <button type="button" className="btn btn-sm btn-light" onClick={() => addOutput(outcome.id)}>
                                Add Output
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-end gap-2">
                      <button type="button" className="btn btn-light" onClick={addOutcome}>
                        Add Outcome
                      </button>
                      <button type="button" className="btn btn-success" onClick={handleSaveStructure} disabled={!structureDirty || savingStructure}>
                        {savingStructure ? 'Saving...' : 'Save Structure'}
                      </button>
                    </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

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

            {!editingProgramId && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                This creates the program first. The hierarchy is added from the selected program view.
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
              <DialogTitle className="text-2xl font-bold text-slate-900">Budget Line Input</DialogTitle>
              <DialogDescription>
                Enter quantity, frequency, unit price, and units. The total is calculated automatically.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            {budgetDraft && (
              <>
                <div>
                  <label className="form-label text-slate-900">Budget Line Name</label>
                  <input
                    className="input"
                    value={budgetDraft.name}
                    onChange={(event) => setBudgetDraft((current) => current ? { ...current, name: event.target.value } : current)}
                    placeholder="Budget line name"
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
                    Save Budget Line
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
