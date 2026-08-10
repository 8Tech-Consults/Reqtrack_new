import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Container } from '@/components/container';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

const calculateBudgetLineTotal = (draft: Pick<BudgetLineDraft, 'quantity' | 'frequency' | 'unitPrice' | 'units'>) => {
  const quantity = Number(draft.quantity || 0);
  const frequency = Number(draft.frequency || 0);
  const unitPrice = Number(draft.unitPrice || 0);
  const units = Number(draft.units || 0);
  return quantity * frequency * unitPrice * units;
};

export const ProjectsPage = () => {
  const { auth } = useAuthContext();
  const permissions = useMemo(() => getPermissionsFromToken(auth?.access_token), [auth?.access_token]);
  const canManagePrograms = Boolean(
    permissions.can_manage_projects ||
      permissions.can_create_projects ||
      permissions.can_edit_projects ||
      permissions.can_manage_templates ||
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
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetLineDraft | null>(null);

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
      name: `Budget Line`,
      quantity: '1',
      frequency: '1',
      unitPrice: '0',
      units: '1'
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
      units: String(existingBudgetLine?.units ?? 1)
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
        existingBudgetLine.units = Number(budgetDraft.units || 0);
        existingBudgetLine.totalAmount = totalAmount;
        existingBudgetLine.sortOrder = existingBudgetLine.sortOrder;
      } else {
        activity.budgetLines.push({
          id: makeId('line'),
          name: budgetDraft.name.trim() || 'Budget Line',
          quantity: Number(budgetDraft.quantity || 0),
          frequency: Number(budgetDraft.frequency || 0),
          unitPrice: Number(budgetDraft.unitPrice || 0),
          units: Number(budgetDraft.units || 0),
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
            name: programName.trim(),
            description: programDescription.trim() || null,
            budgetAmount: Number(budgetAmount || 0),
            programManagerId: programManagerId || null,
            status: 'active'
          }
        }
      });

      const createdProgram = response.data?.createProgram?.program;
      await refetch();
      setCreateOpen(false);
      setProgramName('');
      setProgramDescription('');
      setBudgetAmount('');
      setProgramManagerId('');

      if (createdProgram?.id) {
        setSelectedProgramId(createdProgram.id);
      }

      toast.success('Program created successfully.');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create program.');
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
      setSaveError(error instanceof Error ? error.message : 'Failed to save program structure.');
    } finally {
      setSavingStructure(false);
    }
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
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              New Program
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Programs" value={stats.programs} />
          <StatCard label="Total Budget" value={formatMoney(stats.budget)} />
          <StatCard label="Outcomes" value={stats.outcomes} />
          <StatCard label="Activities" value={stats.activities} />
          <StatCard label="Budget Lines" value={stats.budgetLines} />
        </div>

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
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setCreateOpen(true)}>
                    Create Program
                  </button>
                )}
              </div>

              {programs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-3">
                  <p>No programs have been created yet.</p>
                  {canManagePrograms && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)}>
                      Create First Program
                    </button>
                  )}
                </div>
              ) : (
                programs.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => setSelectedProgramId(program.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${selectedProgram?.id === program.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{program.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatMoney(program.budgetAmount)} · {program.programManagerName || 'Unassigned'}
                    </p>
                  </button>
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
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedProgram.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{selectedProgram.description || 'No description provided.'}</p>
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
                    <div className="flex items-end gap-2">
                      <button type="button" className="btn btn-light" onClick={addOutcome}>
                        Add Outcome
                      </button>
                      <button type="button" className="btn btn-success" onClick={handleSaveStructure} disabled={!structureDirty || savingStructure}>
                        {savingStructure ? 'Saving...' : 'Save Structure'}
                      </button>
                    </div>
                  </div>

                  {saveError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</div>}

                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Create the program first, then manually add outcomes, outputs, activities, and budget lines below.
                  </div>

                  <div className="space-y-3">
                    {selectedProgram.outcomes.map((outcome) => (
                      <div key={outcome.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input className="input" value={outcome.name} onChange={(event) => renameOutcome(outcome.id, event.target.value)} />
                          <button type="button" className="btn btn-sm btn-light" onClick={() => addOutput(outcome.id)}>
                            Add Output
                          </button>
                          <button type="button" className="btn btn-sm btn-light" onClick={() => removeOutcome(outcome.id)}>
                            Remove
                          </button>
                        </div>

                        <div className="mt-2 space-y-2 pl-2 border-l border-slate-200">
                          {outcome.outputs.map((output) => (
                            <div key={output.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <input className="input" value={output.name} onChange={(event) => renameOutput(outcome.id, output.id, event.target.value)} />
                                <button type="button" className="btn btn-sm btn-light" onClick={() => addActivity(outcome.id, output.id)}>
                                  Add Activity
                                </button>
                                <button type="button" className="btn btn-sm btn-light" onClick={() => removeOutput(outcome.id, output.id)}>
                                  Remove
                                </button>
                              </div>

                              <div className="mt-2 space-y-2 pl-2 border-l border-slate-200">
                                {output.activities.map((activity) => (
                                  <div key={activity.id} className="rounded border border-slate-200 bg-white p-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input className="input" value={activity.name} onChange={(event) => renameActivity(outcome.id, output.id, activity.id, event.target.value)} />
                                      <button type="button" className="btn btn-sm btn-light" onClick={() => addBudgetLine(outcome.id, output.id, activity.id)}>
                                        Add Budget Line
                                      </button>
                                      <button type="button" className="btn btn-sm btn-light" onClick={() => removeActivity(outcome.id, output.id, activity.id)}>
                                        Remove
                                      </button>
                                    </div>

                                    <div className="mt-2 space-y-2 pl-2 border-l border-slate-200">
                                      {activity.budgetLines.map((budgetLine) => (
                                        <div key={budgetLine.id} className="rounded border border-slate-200 bg-white p-2">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                              <p className="text-sm font-medium text-slate-900">{budgetLine.name}</p>
                                              <p className="text-xs text-slate-500">
                                                {budgetLine.quantity} x {budgetLine.frequency} x {formatMoney(budgetLine.unitPrice)} x {budgetLine.units}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-semibold text-slate-900">{formatMoney(budgetLine.totalAmount)}</span>
                                              <button type="button" className="btn btn-sm btn-light" onClick={() => openBudgetLineSheet(outcome.id, output.id, activity.id, budgetLine.id)}>
                                                Edit
                                              </button>
                                              <button type="button" className="btn btn-sm btn-light" onClick={() => removeBudgetLine(outcome.id, output.id, activity.id, budgetLine.id)}>
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
            <DialogTitle className="text-base font-semibold text-slate-900">Create Program</DialogTitle>
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

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              This creates the program first. The hierarchy is added from the selected program view.
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-light" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creatingProgram}>
                {creatingProgram ? 'Creating...' : 'Create Program'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={budgetSheetOpen} onOpenChange={setBudgetSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto">
          <div className="p-6 border-b bg-slate-50/50">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold text-slate-900">Budget Line Input</SheetTitle>
              <SheetDescription>
                Enter quantity, frequency, unit price, and units. The total is calculated automatically.
              </SheetDescription>
            </SheetHeader>
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
                      type="number"
                      min={0}
                      step="any"
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
        </SheetContent>
      </Sheet>
    </Container>
  );
};

export default ProjectsPage;
