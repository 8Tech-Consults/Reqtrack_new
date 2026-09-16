import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { ChevronDown, ChevronRight, MoreVertical, Pencil, Trash2, ArrowRight, ChevronsRight, Upload, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
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
import { URL_2 } from '@/config/urls';
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
  ProgramBudgetUploadResult,
  SAVE_PROGRAM_STRUCTURE,
  UPLOAD_PROGRAM_BUDGET
} from '@/gql/programs';
import { DashboardSectionHeading } from '../dashboards';

type Outcome = ProgramRecord['outcomes'][number];
type Output = Outcome['outputs'][number];
type Activity = Output['activities'][number];
type BudgetLine = Activity['budgetLines'][number];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(value || 0);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const activityTotal = (activity: Activity) => activity.budgetLines.reduce((sum, line) => sum + Number(line.totalAmount || 0), 0);
const outputTotal = (output: Output) => output.activities.reduce((sum, activity) => sum + activityTotal(activity), 0);
const outcomeTotal = (outcome: Outcome) => outcome.outputs.reduce((sum, output) => sum + outputTotal(output), 0);

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
  return quantity * frequency * unitPrice;
};

// --- Immutable, path-scoped update helpers ---------------------------------
// Only the nodes on the path to the edited item get a new reference; every
// sibling subtree keeps its old reference. That's what lets the memoized row
// components below skip re-rendering rows the user isn't touching, and it
// means a keystroke no longer deep-clones the whole program tree.
const replaceOutcome = (program: ProgramRecord, outcomeId: string, fn: (o: Outcome) => Outcome): ProgramRecord => ({
  ...program,
  outcomes: program.outcomes.map((o) => (o.id === outcomeId ? fn(o) : o))
});

const replaceOutput = (outcome: Outcome, outputId: string, fn: (o: Output) => Output): Outcome => ({
  ...outcome,
  outputs: outcome.outputs.map((o) => (o.id === outputId ? fn(o) : o))
});

const replaceActivity = (output: Output, activityId: string, fn: (a: Activity) => Activity): Output => ({
  ...output,
  activities: output.activities.map((a) => (a.id === activityId ? fn(a) : a))
});

const updateActivityInProgram = (
  program: ProgramRecord,
  outcomeId: string,
  outputId: string,
  activityId: string,
  fn: (a: Activity) => Activity
): ProgramRecord =>
  replaceOutcome(program, outcomeId, (outcome) => replaceOutput(outcome, outputId, (output) => replaceActivity(output, activityId, fn)));

// Row-action kebab menu used at every hierarchy level below "Outcome".
const RowActionsMenu = memo(function RowActionsMenu({
  onEdit,
  onRemove,
  editLabel = 'Edit',
  removeLabel = 'Remove'
}: {
  onEdit?: () => void;
  onRemove: () => void;
  editLabel?: string;
  removeLabel?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="btn btn-icon btn-sm btn-light shrink-0" aria-label="Row actions">
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
});

const BudgetLineRow = memo(function BudgetLineRow({
  budgetLine,
  onEdit,
  onRemove
}: {
  budgetLine: BudgetLine;
  onEdit: (budgetLine: BudgetLine) => void;
  onRemove: (budgetLineId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="flex items-center text-emerald-500 shrink-0 mt-0.5">
            <ChevronsRight size={14} />
            <ChevronsRight size={14} className="-ml-2" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{budgetLine.name}</p>
            <p className="text-xs text-slate-500">
              {budgetLine.quantity} x {budgetLine.frequency} x {formatMoney(budgetLine.unitPrice)} = {formatMoney(budgetLine.totalAmount)}{' '}
              {budgetLine.units}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-slate-900">{formatMoney(budgetLine.totalAmount)}</span>
          <RowActionsMenu editLabel="Edit" onEdit={() => onEdit(budgetLine)} onRemove={() => onRemove(budgetLine.id)} />
        </div>
      </div>
    </div>
  );
});

// Shared by both the Activity-type hierarchy and the Admin-type "activities
// only" view, eliminating the ~90-line duplicated block that used to live
// in both branches of the JSX.
const ActivityCard = memo(function ActivityCard({
  outcomeId,
  outputId,
  activity,
  collapsed,
  onToggle,
  onRename,
  onRemove,
  onOpenBudgetLine,
  onRemoveBudgetLine
}: {
  outcomeId: string;
  outputId: string;
  activity: Activity;
  collapsed: boolean;
  onToggle: (activityId: string) => void;
  onRename: (outcomeId: string, outputId: string, activityId: string, name: string) => void;
  onRemove: (outcomeId: string, outputId: string, activityId: string) => void;
  onOpenBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLine?: BudgetLine) => void;
  onRemoveBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLineId: string) => void;
}) {
  const handleEditLine = useCallback(
    (budgetLine: BudgetLine) => onOpenBudgetLine(outcomeId, outputId, activity.id, budgetLine),
    [onOpenBudgetLine, outcomeId, outputId, activity.id]
  );
  const handleRemoveLine = useCallback(
    (budgetLineId: string) => onRemoveBudgetLine(outcomeId, outputId, activity.id, budgetLineId),
    [onRemoveBudgetLine, outcomeId, outputId, activity.id]
  );

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-icon btn-sm btn-light shrink-0"
          onClick={() => onToggle(activity.id)}
          aria-label={collapsed ? 'Expand activity' : 'Collapse activity'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="flex items-center text-purple-500 shrink-0">
          <ChevronsRight size={14} />
        </span>
        <input
          className="input flex-1 min-w-[160px]"
          value={activity.name}
          onChange={(event) => onRename(outcomeId, outputId, activity.id, event.target.value)}
        />
        <input className="input w-40 shrink-0" value={formatMoney(activityTotal(activity))} readOnly title="Total budget for this activity" />
        <RowActionsMenu onRemove={() => onRemove(outcomeId, outputId, activity.id)} />
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-purple-200">
          {activity.budgetLines.map((budgetLine) => (
            <BudgetLineRow key={budgetLine.id} budgetLine={budgetLine} onEdit={handleEditLine} onRemove={handleRemoveLine} />
          ))}
          <button type="button" className="btn btn-sm btn-light" onClick={() => onOpenBudgetLine(outcomeId, outputId, activity.id)}>
            Add Budget Line
          </button>
        </div>
      )}
    </div>
  );
});

const OutputCard = memo(function OutputCard({
  outcomeId,
  output,
  collapsed,
  collapsedActivities,
  onToggle,
  onToggleActivity,
  onRename,
  onRemove,
  onRenameActivity,
  onRemoveActivity,
  onAddActivity,
  onOpenBudgetLine,
  onRemoveBudgetLine
}: {
  outcomeId: string;
  output: Output;
  collapsed: boolean;
  collapsedActivities: Set<string>;
  onToggle: (outputId: string) => void;
  onToggleActivity: (activityId: string) => void;
  onRename: (outcomeId: string, outputId: string, name: string) => void;
  onRemove: (outcomeId: string, outputId: string) => void;
  onRenameActivity: (outcomeId: string, outputId: string, activityId: string, name: string) => void;
  onRemoveActivity: (outcomeId: string, outputId: string, activityId: string) => void;
  onAddActivity: (outcomeId: string, outputId: string) => void;
  onOpenBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLine?: BudgetLine) => void;
  onRemoveBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLineId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-icon btn-sm btn-light shrink-0"
          onClick={() => onToggle(output.id)}
          aria-label={collapsed ? 'Expand output' : 'Collapse output'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <ArrowRight size={14} className="text-blue-500 shrink-0" />
        <input className="input flex-1 min-w-[160px]" value={output.name} onChange={(event) => onRename(outcomeId, output.id, event.target.value)} />
        <input className="input w-40 shrink-0" value={formatMoney(outputTotal(output))} readOnly title="Total budget for this output" />
        <RowActionsMenu onRemove={() => onRemove(outcomeId, output.id)} />
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-blue-200">
          {output.activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              outcomeId={outcomeId}
              outputId={output.id}
              activity={activity}
              collapsed={collapsedActivities.has(activity.id)}
              onToggle={onToggleActivity}
              onRename={onRenameActivity}
              onRemove={onRemoveActivity}
              onOpenBudgetLine={onOpenBudgetLine}
              onRemoveBudgetLine={onRemoveBudgetLine}
            />
          ))}
          <button type="button" className="btn btn-sm btn-light" onClick={() => onAddActivity(outcomeId, output.id)}>
            Add Activity
          </button>
        </div>
      )}
    </div>
  );
});

const OutcomeCard = memo(function OutcomeCard({
  outcome,
  collapsed,
  collapsedOutputs,
  collapsedActivities,
  onToggle,
  onToggleOutput,
  onToggleActivity,
  onRename,
  onRemove,
  onRenameOutput,
  onRemoveOutput,
  onAddOutput,
  onRenameActivity,
  onRemoveActivity,
  onAddActivity,
  onOpenBudgetLine,
  onRemoveBudgetLine
}: {
  outcome: Outcome;
  collapsed: boolean;
  collapsedOutputs: Set<string>;
  collapsedActivities: Set<string>;
  onToggle: (outcomeId: string) => void;
  onToggleOutput: (outputId: string) => void;
  onToggleActivity: (activityId: string) => void;
  onRename: (outcomeId: string, name: string) => void;
  onRemove: (outcomeId: string) => void;
  onRenameOutput: (outcomeId: string, outputId: string, name: string) => void;
  onRemoveOutput: (outcomeId: string, outputId: string) => void;
  onAddOutput: (outcomeId: string) => void;
  onRenameActivity: (outcomeId: string, outputId: string, activityId: string, name: string) => void;
  onRemoveActivity: (outcomeId: string, outputId: string, activityId: string) => void;
  onAddActivity: (outcomeId: string, outputId: string) => void;
  onOpenBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLine?: BudgetLine) => void;
  onRemoveBudgetLine: (outcomeId: string, outputId: string, activityId: string, budgetLineId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-icon btn-sm btn-light shrink-0"
          onClick={() => onToggle(outcome.id)}
          aria-label={collapsed ? 'Expand outcome' : 'Collapse outcome'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <input className="input flex-1 min-w-[160px] font-medium" value={outcome.name} onChange={(event) => onRename(outcome.id, event.target.value)} />
        <input className="input w-40 shrink-0" value={formatMoney(outcomeTotal(outcome))} readOnly title="Total budget for this outcome" />
        <RowActionsMenu onRemove={() => onRemove(outcome.id)} />
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
          {outcome.outputs.map((output) => (
            <OutputCard
              key={output.id}
              outcomeId={outcome.id}
              output={output}
              collapsed={collapsedOutputs.has(output.id)}
              collapsedActivities={collapsedActivities}
              onToggle={onToggleOutput}
              onToggleActivity={onToggleActivity}
              onRename={onRenameOutput}
              onRemove={onRemoveOutput}
              onRenameActivity={onRenameActivity}
              onRemoveActivity={onRemoveActivity}
              onAddActivity={onAddActivity}
              onOpenBudgetLine={onOpenBudgetLine}
              onRemoveBudgetLine={onRemoveBudgetLine}
            />
          ))}
          <button type="button" className="btn btn-sm btn-light" onClick={() => onAddOutput(outcome.id)}>
            Add Output
          </button>
        </div>
      )}
    </div>
  );
});

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

  const [createProgram] = useMutation<
    { createProgram: { success: boolean; message?: string; program?: ProgramRecord | null } },
    { input: Record<string, unknown> }
  >(CREATE_PROGRAM, {
    refetchQueries: [{ query: GET_PROGRAMS }, { query: GET_PROGRAM_MANAGERS }],
    awaitRefetchQueries: true
  });
  const [saveProgramStructure] = useMutation<{ saveProgramStructure: { success: boolean; message?: string } }, { input: Record<string, unknown> }>(
    SAVE_PROGRAM_STRUCTURE,
    {
      refetchQueries: [{ query: GET_PROGRAMS }],
      awaitRefetchQueries: true
    }
  );
  const [deleteProgram] = useMutation<{ deleteProgram: { success: boolean; message?: string } }, { id: string }>(DELETE_PROGRAM, {
    refetchQueries: [{ query: GET_PROGRAMS }],
    awaitRefetchQueries: true
  });
  const [uploadProgramBudget, { loading: uploadingBudget }] = useMutation<
    { uploadProgramBudget: ProgramBudgetUploadResult },
    { programId: string; file: File }
  >(UPLOAD_PROGRAM_BUDGET, {
    refetchQueries: [{ query: GET_PROGRAMS }],
    awaitRefetchQueries: true
  });

  const programs = data?.programs || [];
  const managers = managerData?.programManagers || [];

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [draftProgram, setDraftProgram] = useState<ProgramRecord | null>(null);
  const [structureDirty, setStructureDirty] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [createError, setCreateError] = useState('');
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [programManagerId, setProgramManagerId] = useState('');
  const [programType, setProgramType] = useState<'Activity' | 'Admin'>('Activity');
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetLineDraft | null>(null);
  const [collapsedOutcomes, setCollapsedOutcomes] = useState<Set<string>>(new Set());
  const [collapsedOutputs, setCollapsedOutputs] = useState<Set<string>>(new Set());
  const [collapsedActivities, setCollapsedActivities] = useState<Set<string>>(new Set());

  const budgetFileInputRef = useRef<HTMLInputElement>(null);
  const [budgetUploadSheetOpen, setBudgetUploadSheetOpen] = useState(false);
  const [budgetUploadErrors, setBudgetUploadErrors] = useState<string[]>([]);

  // Inline "Add a brief program description..." affordance (Program header).
  // NOTE: SAVE_PROGRAM_STRUCTURE currently only persists the outcomes tree.
  // This updates the local draft (and flags structureDirty) so it rides
  // along with the next structure save; if description needs its own
  // mutation/field on the backend, swap the onSave handler below to call it.
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');

  const toggleId = useCallback((setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleOutcome = useCallback((outcomeId: string) => toggleId(setCollapsedOutcomes, outcomeId), [toggleId]);
  const toggleOutput = useCallback((outputId: string) => toggleId(setCollapsedOutputs, outputId), [toggleId]);
  const toggleActivity = useCallback((activityId: string) => toggleId(setCollapsedActivities, activityId), [toggleId]);

  useEffect(() => {
    if (!programs.length) {
      setSelectedProgramId('');
      setDraftProgram(null);
      return;
    }

    // Deep-link support: a notification (or any other external link) can
    // send the user here with ?program=<id> to jump straight to that
    // program instead of whatever would otherwise be selected by default.
    const requestedProgramId = searchParams.get('program');
    if (requestedProgramId && programs.some((program) => program.id === requestedProgramId)) {
      if (selectedProgramId !== requestedProgramId) {
        setSelectedProgramId(requestedProgramId);
      }
      setSearchParams(
        (prev) => {
          prev.delete('program');
          return prev;
        },
        { replace: true }
      );
      return;
    }

    if (!selectedProgramId || !programs.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId, searchParams, setSearchParams]);

  useEffect(() => {
    const selected = programs.find((program) => program.id === selectedProgramId) || null;
    // Reuse the server copy directly rather than deep-cloning it: our update
    // helpers only ever replace nodes immutably, so a defensive clone here
    // was never buying us anything beyond a wasted full-tree copy per switch.
    setDraftProgram(selected);
    setStructureDirty(false);
    setEditingDescription(false);
    setDescriptionDraft(selected?.description || '');
    setBudgetUploadErrors([]);
  }, [programs, selectedProgramId]);

  const selectedProgram = draftProgram;
  // Admin-type programs store their activities under one hidden outcome/output
  // pair created by the server at program creation time; the UI never shows
  // that pair, it just reads/writes through it.
  const adminOutcome = selectedProgram?.type === 'Admin' ? selectedProgram.outcomes[0] : undefined;
  const adminOutput = adminOutcome?.outputs[0];

  const updateDraft = useCallback((updater: (program: ProgramRecord) => ProgramRecord) => {
    setDraftProgram((current) => (current ? updater(current) : current));
    setStructureDirty(true);
  }, []);

  const addOutcome = useCallback(() => {
    updateDraft((program) => ({
      ...program,
      outcomes: [
        ...program.outcomes,
        { id: makeId('outcome'), name: `Outcome ${program.outcomes.length + 1}`, sortOrder: program.outcomes.length, outputs: [] }
      ]
    }));
  }, [updateDraft]);

  const addOutput = useCallback(
    (outcomeId: string) => {
      updateDraft((program) =>
        replaceOutcome(program, outcomeId, (outcome) => ({
          ...outcome,
          outputs: [
            ...outcome.outputs,
            { id: makeId('output'), name: `Output ${outcome.outputs.length + 1}`, sortOrder: outcome.outputs.length, activities: [] }
          ]
        }))
      );
    },
    [updateDraft]
  );

  const addActivity = useCallback(
    (outcomeId: string, outputId: string) => {
      updateDraft((program) =>
        replaceOutcome(program, outcomeId, (outcome) =>
          replaceOutput(outcome, outputId, (output) => ({
            ...output,
            activities: [
              ...output.activities,
              { id: makeId('activity'), name: `Activity ${output.activities.length + 1}`, sortOrder: output.activities.length, budgetLines: [] }
            ]
          }))
        )
      );
    },
    [updateDraft]
  );

  const renameOutcome = useCallback(
    (outcomeId: string, name: string) => {
      updateDraft((program) => replaceOutcome(program, outcomeId, (outcome) => ({ ...outcome, name })));
    },
    [updateDraft]
  );

  const renameOutput = useCallback(
    (outcomeId: string, outputId: string, name: string) => {
      updateDraft((program) => replaceOutcome(program, outcomeId, (outcome) => replaceOutput(outcome, outputId, (output) => ({ ...output, name }))));
    },
    [updateDraft]
  );

  const renameActivity = useCallback(
    (outcomeId: string, outputId: string, activityId: string, name: string) => {
      updateDraft((program) => updateActivityInProgram(program, outcomeId, outputId, activityId, (activity) => ({ ...activity, name })));
    },
    [updateDraft]
  );

  // Opens the sheet both for "Add Budget Line" (budgetLine omitted) and for
  // editing an existing one (budgetLine passed in directly by the row that
  // rendered it, so there's no need to re-search the tree for it here).
  const openBudgetLineSheet = useCallback((outcomeId: string, outputId: string, activityId: string, budgetLine?: BudgetLine) => {
    setBudgetDraft({
      outcomeId,
      outputId,
      activityId,
      budgetLineId: budgetLine?.id || null,
      name: budgetLine?.name || 'Budget Line',
      quantity: String(budgetLine?.quantity ?? 1),
      frequency: String(budgetLine?.frequency ?? 1),
      unitPrice: String(budgetLine?.unitPrice ?? 0),
      units: String(budgetLine?.units ?? '')
    });
    setBudgetSheetOpen(true);
  }, []);

  const handleSaveBudgetLine = useCallback(() => {
    if (!budgetDraft) return;
    const totalAmount = calculateBudgetLineTotal(budgetDraft);

    updateDraft((program) =>
      updateActivityInProgram(program, budgetDraft.outcomeId, budgetDraft.outputId, budgetDraft.activityId, (activity) => {
        const isExisting = budgetDraft.budgetLineId && activity.budgetLines.some((line) => line.id === budgetDraft.budgetLineId);

        if (isExisting) {
          return {
            ...activity,
            budgetLines: activity.budgetLines.map((line) =>
              line.id === budgetDraft.budgetLineId
                ? {
                    ...line,
                    name: budgetDraft.name.trim() || 'Budget Line',
                    quantity: Number(budgetDraft.quantity || 0),
                    frequency: Number(budgetDraft.frequency || 0),
                    unitPrice: Number(budgetDraft.unitPrice || 0),
                    units: budgetDraft.units || '',
                    totalAmount
                  }
                : line
            )
          };
        }

        return {
          ...activity,
          budgetLines: [
            ...activity.budgetLines,
            {
              id: makeId('line'),
              name: budgetDraft.name.trim() || 'Budget Line',
              quantity: Number(budgetDraft.quantity || 0),
              frequency: Number(budgetDraft.frequency || 0),
              unitPrice: Number(budgetDraft.unitPrice || 0),
              units: budgetDraft.units || '',
              totalAmount,
              sortOrder: activity.budgetLines.length
            }
          ]
        };
      })
    );

    setBudgetSheetOpen(false);
    setBudgetDraft(null);
  }, [budgetDraft, updateDraft]);

  const removeOutcome = useCallback(
    (outcomeId: string) => {
      updateDraft((program) => ({ ...program, outcomes: program.outcomes.filter((outcome) => outcome.id !== outcomeId) }));
    },
    [updateDraft]
  );

  const removeOutput = useCallback(
    (outcomeId: string, outputId: string) => {
      updateDraft((program) =>
        replaceOutcome(program, outcomeId, (outcome) => ({ ...outcome, outputs: outcome.outputs.filter((output) => output.id !== outputId) }))
      );
    },
    [updateDraft]
  );

  const removeActivity = useCallback(
    (outcomeId: string, outputId: string, activityId: string) => {
      updateDraft((program) =>
        replaceOutcome(program, outcomeId, (outcome) =>
          replaceOutput(outcome, outputId, (output) => ({ ...output, activities: output.activities.filter((activity) => activity.id !== activityId) }))
        )
      );
    },
    [updateDraft]
  );

  const removeBudgetLine = useCallback(
    (outcomeId: string, outputId: string, activityId: string, budgetLineId: string) => {
      updateDraft((program) =>
        updateActivityInProgram(program, outcomeId, outputId, activityId, (activity) => ({
          ...activity,
          budgetLines: activity.budgetLines.filter((line) => line.id !== budgetLineId)
        }))
      );
    },
    [updateDraft]
  );

  const handleOpenCreateProgram = () => {
    setEditingProgramId(null);
    setProgramName('');
    setProgramDescription('');
    setBudgetAmount('');
    setProgramManagerId('');
    setProgramType('Activity');
    setCreateError('');
    setCreateOpen(true);
  };

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
      toast.error(error instanceof Error ? error.message : 'Failed to save program structure.');
    } finally {
      setSavingStructure(false);
    }
  };

  const handleUploadBudgetClick = () => {
    if (!selectedProgram) return;
    budgetFileInputRef.current?.click();
  };

  const handleBudgetFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    // Reset so picking the same file again (e.g. after fixing it) still fires onChange.
    event.target.value = '';
    if (!file || !selectedProgram) return;

    const confirmed = window.confirm(
      `Uploading will replace "${selectedProgram.name}"'s entire current budget with the contents of this file. Continue?`
    );
    if (!confirmed) return;

    setBudgetUploadErrors([]);

    try {
      const response = await uploadProgramBudget({ variables: { programId: selectedProgram.id, file } });
      const result = response.data?.uploadProgramBudget;

      if (result?.success) {
        toast.success(result.message);
      } else if (result?.errors?.length) {
        setBudgetUploadErrors(result.errors);
        toast.error('The file has errors - see details below.');
      } else {
        toast.error(result?.message || 'Unable to upload this budget. Please try again.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to upload this budget. Please try again.');
    }
  };

  const handleSaveDescription = () => {
    updateDraft((program) => ({ ...program, description: descriptionDraft.trim() }));
    setEditingDescription(false);
  };

  return (
    <Container>
      <div className="space-y-7 lg:space-y-9">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {/* <h1 className="text-xl lg:text-2xl font-semibold text-slate-900">Programs</h1> */}
            <DashboardSectionHeading id="analytics-heading" title="Analytics" />
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
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Failed to load programs.</div>
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
                    className={`w-full rounded-lg border px-3 py-2 text-left cursor-pointer flex items-start justify-between gap-2 ${
                      selectedProgram?.id === program.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
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
                    <div className="flex items-center gap-2 shrink-0">
                      {selectedProgram.type === 'Admin' && (
                        <span className="badge badge-outline border-purple-200 bg-purple-50 text-purple-700">Admin</span>
                      )}
                      <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">{selectedProgram.status}</span>
                    </div>
                  </div>

                  {canManagePrograms && (
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn btn-sm btn-light gap-1.5" onClick={() => setBudgetUploadSheetOpen(true)}>
                        <Upload size={14} />
                        Import Budget
                      </button>
                    </div>
                  )}

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

                  {selectedProgram.type === 'Admin' ? (
                    <>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                        {!adminOutcome || !adminOutput ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            This admin program is missing its budget container. Please contact support.
                          </div>
                        ) : (
                          adminOutput.activities.map((activity) => (
                            <ActivityCard
                              key={activity.id}
                              outcomeId={adminOutcome.id}
                              outputId={adminOutput.id}
                              activity={activity}
                              collapsed={collapsedActivities.has(activity.id)}
                              onToggle={toggleActivity}
                              onRename={renameActivity}
                              onRemove={removeActivity}
                              onOpenBudgetLine={openBudgetLineSheet}
                              onRemoveBudgetLine={removeBudgetLine}
                            />
                          ))
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          className="btn btn-light"
                          disabled={!adminOutcome || !adminOutput}
                          onClick={() => adminOutcome && adminOutput && addActivity(adminOutcome.id, adminOutput.id)}
                        >
                          Add Activity
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleSaveStructure} disabled={!structureDirty || savingStructure}>
                          {savingStructure ? 'Saving...' : 'Save Structure'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {selectedProgram.outcomes.map((outcome) => (
                          <OutcomeCard
                            key={outcome.id}
                            outcome={outcome}
                            collapsed={collapsedOutcomes.has(outcome.id)}
                            collapsedOutputs={collapsedOutputs}
                            collapsedActivities={collapsedActivities}
                            onToggle={toggleOutcome}
                            onToggleOutput={toggleOutput}
                            onToggleActivity={toggleActivity}
                            onRename={renameOutcome}
                            onRemove={removeOutcome}
                            onRenameOutput={renameOutput}
                            onRemoveOutput={removeOutput}
                            onAddOutput={addOutput}
                            onRenameActivity={renameActivity}
                            onRemoveActivity={removeActivity}
                            onAddActivity={addActivity}
                            onOpenBudgetLine={openBudgetLineSheet}
                            onRemoveBudgetLine={removeBudgetLine}
                          />
                        ))}
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
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">{editingProgramId ? 'Edit Program' : 'Create Program'}</DialogTitle>
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
                  value={programType === 'Admin' ? 'Admin (activities & budget lines only)' : 'Activity (full hierarchy)'}
                  readOnly
                  title="Program type is locked after creation."
                />
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="radio" name="programType" className="mt-1" checked={programType === 'Activity'} onChange={() => setProgramType('Activity')} />
                    <span>
                      <span className="font-medium text-slate-900">Activity</span> — full outcome / output / activity / budget line hierarchy.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="radio" name="programType" className="mt-1" checked={programType === 'Admin'} onChange={() => setProgramType('Admin')} />
                    <span>
                      <span className="font-medium text-slate-900">Admin</span> — activities and budget lines only, no outcomes/outputs.
                    </span>
                  </label>
                </div>
              )}
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
              <DialogDescription>Enter quantity, frequency, unit price, and units. The total is calculated automatically.</DialogDescription>
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
                    onChange={(event) => setBudgetDraft((current) => (current ? { ...current, name: event.target.value } : current))}
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
                      onChange={(event) => setBudgetDraft((current) => (current ? { ...current, quantity: event.target.value } : current))}
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
                      onChange={(event) => setBudgetDraft((current) => (current ? { ...current, frequency: event.target.value } : current))}
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
                      onChange={(event) => setBudgetDraft((current) => (current ? { ...current, unitPrice: event.target.value } : current))}
                    />
                  </div>
                  <div>
                    <label className="form-label text-slate-900">Units</label>
                    <input
                      className="input"
                      value={budgetDraft.units}
                      onChange={(event) => setBudgetDraft((current) => (current ? { ...current, units: event.target.value } : current))}
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

      <Sheet open={budgetUploadSheetOpen} onOpenChange={setBudgetUploadSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[620px] h-full flex flex-col p-0">
          <div className="p-6 border-b bg-slate-50/50">
            <SheetHeader>
              <SheetTitle>Import Budget from Excel</SheetTitle>
              <SheetDescription>{selectedProgram ? `Upload a budget for "${selectedProgram.name}"` : 'Select a program first'}</SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm font-medium text-slate-900">1. Download the template</p>
              <p className="text-xs text-slate-500">Fill in the Outcome / Output / Activity / Cost type rows for this program's budget.</p>
              <a href={`${URL_2}/templates/budget-upload-template.xlsx`} className="btn btn-sm btn-light gap-1.5 w-fit" download>
                Download Budget Template
              </a>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-sm font-medium text-slate-900">2. Upload the completed file</p>
              <p className="text-xs text-amber-700">This replaces this program's entire current budget with the uploaded file.</p>
              <button type="button" className="btn btn-sm btn-primary gap-1.5 w-fit" onClick={handleUploadBudgetClick} disabled={uploadingBudget || !selectedProgram}>
                <Upload size={14} />
                {uploadingBudget ? 'Uploading...' : 'Choose File & Upload'}
              </button>
              <input ref={budgetFileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleBudgetFileSelected} />
            </div>

            {!!budgetUploadErrors.length && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-rose-700">
                    The uploaded file has {budgetUploadErrors.length === 1 ? 'an error' : `${budgetUploadErrors.length} errors`} - nothing was saved:
                  </p>
                  <button type="button" className="btn btn-icon btn-xs btn-clear text-rose-500 shrink-0" onClick={() => setBudgetUploadErrors([])} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5 max-h-60 overflow-y-auto">
                  {budgetUploadErrors.map((err, idx) => (
                    <li key={idx} className="text-xs text-rose-600">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t">
            <button type="button" className="btn btn-light" onClick={() => setBudgetUploadSheetOpen(false)}>
              Close
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </Container>
  );
};

export default ProjectsPage;