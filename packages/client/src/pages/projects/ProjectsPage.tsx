import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Container } from '@/components/container';
import { useAuthContext } from '@/auth/useAuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getPermissionsFromToken } from '@/utils/permissions';
import { StatCard } from './components/StatCard';
import {
  ActivityNode,
  AnnualBudgetInput,
  assignProjectYearToStaff,
  calculateBudgetLineAmount,
  createProjectTemplate,
  createProjectYearFromTemplate,
  getHierarchyCounts,
  listAllAnnualBudgets,
  listProjectTemplatesWithYears,
  listStaffMembers,
  OutcomeNode,
  OutputNode,
  ProjectTemplate,
  StaffMember,
  upsertAnnualBudgetInput
} from './data/projectsStubClient';

type WorkspaceView = 'operations' | 'templates';
type TemplatesTab = 'designer' | 'structure';

interface BudgetEditorContext {
  templateId: string;
  projectYearId: string;
  financialYear: number;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-blue-200 bg-blue-50 text-blue-700',
  active: 'border-blue-200 bg-blue-50 text-blue-700'
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(value);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const emptyBudgetInput = (budgetLineId: string): AnnualBudgetInput => ({
  budgetLineId,
  quantity: 1,
  frequency: 1,
  unitCost: 0,
  units: 1,
  actualAmount: 0
});

const ProjectsPage = () => {
  const { auth } = useAuthContext();

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('operations');
  const [templatesTab, setTemplatesTab] = useState<TemplatesTab>('designer');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [annualBudgets, setAnnualBudgets] = useState<
    Record<string, Record<string, AnnualBudgetInput>>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [designerNotice, setDesignerNotice] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<number | null>(null);

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [budgetEditorContext, setBudgetEditorContext] = useState<BudgetEditorContext | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<Record<string, AnnualBudgetInput>>({});

  const [formTemplateId, setFormTemplateId] = useState<string>('');
  const [financialYear, setFinancialYear] = useState<number>(new Date().getFullYear() + 1);
  const [startDate, setStartDate] = useState<string>(`${new Date().getFullYear() + 1}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${new Date().getFullYear() + 1}-12-31`);
  const [submitting, setSubmitting] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const permissions = useMemo(() => getPermissionsFromToken(auth?.access_token), [auth?.access_token]);

  const devAdminPreviewEnabled = useMemo(() => {
    if (!import.meta.env.DEV) return false;
    return localStorage.getItem('projects.adminPreview') === 'true';
  }, []);

  const canAccessTemplateAdmin = useMemo(() => {
    return Boolean(
      devAdminPreviewEnabled ||
      permissions.can_manage_projects ||
        permissions.can_create_projects ||
        permissions.can_edit_projects ||
        permissions.can_manage_templates ||
        permissions.can_manage_users ||
        permissions.can_manage_roles
    );
  }, [permissions, devAdminPreviewEnabled]);

  const refreshBudgets = async () => {
    const result = await listAllAnnualBudgets();
    setAnnualBudgets(result);
  };

  const loadInitial = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesResult, staffResult, budgetsResult] = await Promise.all([
        listProjectTemplatesWithYears(),
        listStaffMembers(),
        listAllAnnualBudgets()
      ]);

      setTemplates(templatesResult);
      setStaffMembers(staffResult);
      setAnnualBudgets(budgetsResult);

      if (!selectedTemplateId && templatesResult.length) {
        const firstId = templatesResult[0].id;
        setSelectedTemplateId(firstId);
        setFormTemplateId(firstId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load projects module data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) || templates[0],
    [templates, selectedTemplateId]
  );

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(templates.flatMap((template) => template.years.map((year) => year.financialYear)))
    );
    return years.sort((a, b) => b - a);
  }, [templates]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedFinancialYear(null);
      return;
    }

    if (!selectedFinancialYear || !availableYears.includes(selectedFinancialYear)) {
      setSelectedFinancialYear(availableYears[0]);
    }
  }, [availableYears, selectedFinancialYear]);

  useEffect(() => {
    if (!canAccessTemplateAdmin && workspaceView === 'templates') {
      setWorkspaceView('operations');
    }
  }, [canAccessTemplateAdmin, workspaceView]);

  const updateTemplateInStore = (
    templateId: string,
    updater: (template: ProjectTemplate) => ProjectTemplate
  ) => {
    setTemplates((prev) =>
      prev.map((template) => {
        if (template.id !== templateId) return template;
        return updater(structuredClone(template));
      })
    );
  };

  const getBudgetInput = (projectYearId: string, budgetLineId: string): AnnualBudgetInput => {
    return annualBudgets[projectYearId]?.[budgetLineId] || emptyBudgetInput(budgetLineId);
  };

  const getActivityTotals = (activity: ActivityNode, projectYearId: string) => {
    const approved = activity.budgetLines.reduce(
      (acc, line) => acc + calculateBudgetLineAmount(getBudgetInput(projectYearId, line.id)),
      0
    );

    const actual = activity.budgetLines.reduce(
      (acc, line) => acc + getBudgetInput(projectYearId, line.id).actualAmount,
      0
    );

    return {
      approved,
      actual,
      variance: approved - actual
    };
  };

  const getOutputTotals = (output: OutputNode, projectYearId: string) => {
    const totals = output.activities.reduce(
      (acc, activity) => {
        const activityTotals = getActivityTotals(activity, projectYearId);
        acc.approved += activityTotals.approved;
        acc.actual += activityTotals.actual;
        return acc;
      },
      { approved: 0, actual: 0 }
    );

    return {
      ...totals,
      variance: totals.approved - totals.actual
    };
  };

  const getOutcomeTotals = (outcome: OutcomeNode, projectYearId: string) => {
    const totals = outcome.outputs.reduce(
      (acc, output) => {
        const outputTotals = getOutputTotals(output, projectYearId);
        acc.approved += outputTotals.approved;
        acc.actual += outputTotals.actual;
        return acc;
      },
      { approved: 0, actual: 0 }
    );

    return {
      ...totals,
      variance: totals.approved - totals.actual
    };
  };

  const getProjectTotals = (template: ProjectTemplate, projectYearId: string) => {
    const totals = template.outcomes.reduce(
      (acc, outcome) => {
        const outcomeTotals = getOutcomeTotals(outcome, projectYearId);
        acc.approved += outcomeTotals.approved;
        acc.actual += outcomeTotals.actual;
        return acc;
      },
      { approved: 0, actual: 0 }
    );

    return {
      ...totals,
      variance: totals.approved - totals.actual
    };
  };

  const selectedYearRecord = useMemo(() => {
    if (!selectedTemplate || !selectedFinancialYear) return null;
    return selectedTemplate.years.find((item) => item.financialYear === selectedFinancialYear) || null;
  }, [selectedTemplate, selectedFinancialYear]);

  const selectedProjectTotals = useMemo(() => {
    if (!selectedTemplate || !selectedYearRecord) return null;
    return getProjectTotals(selectedTemplate, selectedYearRecord.id);
  }, [selectedTemplate, selectedYearRecord, annualBudgets]);

  const selectedCounts = useMemo(
    () => (selectedTemplate ? getHierarchyCounts(selectedTemplate) : null),
    [selectedTemplate]
  );

  const totals = useMemo(() => {
    return templates.reduce(
      (acc, template) => {
        const counts = getHierarchyCounts(template);
        acc.templates += 1;
        acc.years += template.years.length;
        acc.outcomes += counts.outcomeCount;
        acc.outputs += counts.outputCount;
        acc.activities += counts.activityCount;
        acc.budgetLines += counts.budgetLineCount;
        return acc;
      },
      {
        templates: 0,
        years: 0,
        outcomes: 0,
        outputs: 0,
        activities: 0,
        budgetLines: 0
      }
    );
  }, [templates]);

  const yearPrograms = useMemo(() => {
    if (!selectedFinancialYear) return [];

    return templates
      .map((template) => {
        const yearRecord = template.years.find((year) => year.financialYear === selectedFinancialYear);
        if (!yearRecord) return null;

        return {
          template,
          yearRecord,
          totals: getProjectTotals(template, yearRecord.id)
        };
      })
      .filter((item): item is { template: ProjectTemplate; yearRecord: ProjectTemplate['years'][number]; totals: { approved: number; actual: number; variance: number } } => Boolean(item));
  }, [templates, selectedFinancialYear, annualBudgets]);

  const addOutcome = () => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      template.outcomes.push({
        id: makeId('outcome'),
        name: `New Outcome ${template.outcomes.length + 1}`,
        outputs: []
      });
      return template;
    });
    setDesignerNotice('Template structure updated.');
  };

  const renameOutcome = (outcomeId: string, value: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      if (outcome) outcome.name = value;
      return template;
    });
  };

  const removeOutcome = (outcomeId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      template.outcomes = template.outcomes.filter((item) => item.id !== outcomeId);
      return template;
    });
    setDesignerNotice('Outcome removed.');
  };

  const addOutput = (outcomeId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      if (!outcome) return template;
      outcome.outputs.push({
        id: makeId('output'),
        name: `New Output ${outcome.outputs.length + 1}`,
        activities: []
      });
      return template;
    });
    setDesignerNotice('Output added.');
  };

  const renameOutput = (outcomeId: string, outputId: string, value: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      if (output) output.name = value;
      return template;
    });
  };

  const removeOutput = (outcomeId: string, outputId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      if (!outcome) return template;
      outcome.outputs = outcome.outputs.filter((item) => item.id !== outputId);
      return template;
    });
    setDesignerNotice('Output removed.');
  };

  const addActivity = (outcomeId: string, outputId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      if (!output) return template;
      output.activities.push({
        id: makeId('activity'),
        name: `New Activity ${output.activities.length + 1}`,
        budgetLines: []
      });
      return template;
    });
    setDesignerNotice('Activity added.');
  };

  const renameActivity = (outcomeId: string, outputId: string, activityId: string, value: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      const activity = output?.activities.find((item) => item.id === activityId);
      if (activity) activity.name = value;
      return template;
    });
  };

  const removeActivity = (outcomeId: string, outputId: string, activityId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      if (!output) return template;
      output.activities = output.activities.filter((item) => item.id !== activityId);
      return template;
    });
    setDesignerNotice('Activity removed.');
  };

  const addBudgetLine = (outcomeId: string, outputId: string, activityId: string) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      const activity = output?.activities.find((item) => item.id === activityId);
      if (!activity) return template;
      activity.budgetLines.push({
        id: makeId('bl'),
        name: `New Budget Line ${activity.budgetLines.length + 1}`
      });
      return template;
    });
    setDesignerNotice('Budget line added.');
  };

  const renameBudgetLine = (
    outcomeId: string,
    outputId: string,
    activityId: string,
    budgetLineId: string,
    value: string
  ) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      const activity = output?.activities.find((item) => item.id === activityId);
      const budgetLine = activity?.budgetLines.find((item) => item.id === budgetLineId);
      if (budgetLine) budgetLine.name = value;
      return template;
    });
  };

  const removeBudgetLine = (
    outcomeId: string,
    outputId: string,
    activityId: string,
    budgetLineId: string
  ) => {
    if (!selectedTemplate) return;
    updateTemplateInStore(selectedTemplate.id, (template) => {
      const outcome = template.outcomes.find((item) => item.id === outcomeId);
      const output = outcome?.outputs.find((item) => item.id === outputId);
      const activity = output?.activities.find((item) => item.id === activityId);
      if (!activity) return template;
      activity.budgetLines = activity.budgetLines.filter((item) => item.id !== budgetLineId);
      return template;
    });
    setDesignerNotice('Budget line removed.');
  };

  const handleOpenModal = () => {
    setFormError(null);
    setSuccess(null);
    setFormTemplateId(selectedTemplate?.id || templates[0]?.id || '');
    setYearModalOpen(true);
  };

  const handleOpenTemplateModal = () => {
    setTemplateFormError(null);
    setSuccess(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateModalOpen(true);
  };

  const handleCreateTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTemplateFormError(null);
    setSuccess(null);

    if (!templateName.trim()) {
      setTemplateFormError('Template name is required.');
      return;
    }

    setCreatingTemplate(true);
    try {
      const created = await createProjectTemplate({
        name: templateName,
        description: templateDescription
      });

      await loadInitial();
      setSelectedTemplateId(created.id);
      setFormTemplateId(created.id);
      setTemplateModalOpen(false);
      setSuccess(`Template ${created.name} created successfully.`);
      setDesignerNotice('New template created. Add outcomes, outputs, activities, and budget lines.');
    } catch (createError) {
      setTemplateFormError(
        createError instanceof Error ? createError.message : 'Failed to create template.'
      );
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleCreateYear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (!formTemplateId) {
      setFormError('Please select a template.');
      return;
    }

    if (!financialYear) {
      setFormError('Please provide a financial year.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createProjectYearFromTemplate({
        templateId: formTemplateId,
        financialYear,
        startDate,
        endDate
      });

      await loadInitial();
      setSelectedTemplateId(formTemplateId);
      setSelectedFinancialYear(created.financialYear);
      setSuccess(`Project year ${created.financialYear} created successfully.`);
      setYearModalOpen(false);
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : 'Failed to create project year.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignStaff = async (projectYearId: string, staffId: string) => {
    setError(null);
    setSuccess(null);
    try {
      await assignProjectYearToStaff(projectYearId, staffId || null);
      await loadInitial();
      setSuccess('Project year assignment updated.');
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Failed to assign staff.');
    }
  };

  const openBudgetEditor = (templateId: string, projectYearId: string, year: number) => {
    setBudgetEditorContext({ templateId, projectYearId, financialYear: year });
    setBudgetDraft(structuredClone(annualBudgets[projectYearId] || {}));
    setBudgetEditorOpen(true);
  };

  const updateBudgetDraftField = (
    budgetLineId: string,
    field: keyof Omit<AnnualBudgetInput, 'budgetLineId'>,
    value: number
  ) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    setBudgetDraft((prev) => {
      const existing = prev[budgetLineId] || emptyBudgetInput(budgetLineId);
      return {
        ...prev,
        [budgetLineId]: {
          ...existing,
          [field]: safeValue
        }
      };
    });
  };

  const handleSaveBudgetDraft = async () => {
    if (!budgetEditorContext) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const updates = Object.values(budgetDraft).map((item) =>
        upsertAnnualBudgetInput(budgetEditorContext.projectYearId, item.budgetLineId, item)
      );
      await Promise.all(updates);
      await refreshBudgets();
      setSuccess(`Budget for ${budgetEditorContext.financialYear} updated successfully.`);
      setBudgetEditorOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save annual budget inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const budgetEditorTemplate = useMemo(() => {
    if (!budgetEditorContext) return null;
    return templates.find((template) => template.id === budgetEditorContext.templateId) || null;
  }, [budgetEditorContext, templates]);

  const closeBudgetEditor = (open: boolean) => {
    setBudgetEditorOpen(open);
    if (!open) {
      setBudgetEditorContext(null);
      setBudgetDraft({});
    }
  };

  return (
    <Container>
      <div className="py-6 lg:py-8 grid gap-5 lg:gap-7.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-slate-900">Projects Module</h1>
            <p className="text-sm text-slate-500 mt-1">
              Operations and template design are separated. Most users work in Annual Programs only.
            </p>
          </div>

          <button type="button" className="btn btn-primary" onClick={handleOpenModal}>
            Create New Year
          </button>
        </div>

        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard label="Templates" value={totals.templates} />
          <StatCard label="Years" value={totals.years} />
          <StatCard label="Outcomes" value={totals.outcomes} />
          <StatCard label="Outputs" value={totals.outputs} />
          <StatCard label="Activities" value={totals.activities} />
          <StatCard label="Budget Lines" value={totals.budgetLines} />
        </div>

        <Separator className="bg-slate-200" />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${workspaceView === 'operations' ? 'btn-primary' : 'btn-light'}`}
            onClick={() => setWorkspaceView('operations')}
          >
            Annual Programs
          </button>
          {canAccessTemplateAdmin && (
            <button
              type="button"
              className={`btn btn-sm ${workspaceView === 'templates' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setWorkspaceView('templates')}
            >
              Project Templates (Admin)
            </button>
          )}
        </div>

        {workspaceView === 'templates' && canAccessTemplateAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${templatesTab === 'designer' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setTemplatesTab('designer')}
            >
              Edit Structure
            </button>
            <button
              type="button"
              className={`btn btn-sm ${templatesTab === 'structure' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setTemplatesTab('structure')}
            >
              Budget Structure View
            </button>
          </div>
        )}

        {!canAccessTemplateAdmin && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Template editing tools are hidden. Access is restricted to admin users.
          </div>
        )}

        {loading ? (
          <div className="grid lg:grid-cols-3 gap-4">
            <aside className="card p-4 lg:col-span-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </aside>
            <section className="card p-4 lg:col-span-2 space-y-4">
              <Skeleton className="h-6 w-72" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </section>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-4">
            <aside className="card p-4 lg:col-span-1 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Project Templates</h3>
              {!templates.length && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No templates available yet. Create one from Template Designer.
                </div>
              )}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 ${selectedTemplate?.id === template.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{template.years.length} years configured</p>
                </button>
              ))}
            </aside>

            <section className="card p-4 lg:col-span-2 space-y-4">
              {!selectedTemplate ? (
                <p className="text-sm text-slate-500">Select a template to view details.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedTemplate.name}</h2>
                      <p className="text-sm text-slate-500 mt-1">{selectedTemplate.description}</p>
                    </div>
                    <span
                      className={`badge badge-outline ${STATUS_BADGE_CLASS[selectedTemplate.status.toLowerCase()] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      {selectedTemplate.status}
                    </span>
                  </div>

                  {workspaceView === 'operations' && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Years</h4>
                        <div className="flex flex-wrap gap-2">
                          {availableYears.map((year) => (
                            <button
                              key={year}
                              type="button"
                              className={`btn btn-sm ${selectedFinancialYear === year ? 'btn-primary' : 'btn-light'}`}
                              onClick={() => setSelectedFinancialYear(year)}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">Programs in {selectedFinancialYear ?? '-'}</h4>

                        {yearPrograms.map(({ template, yearRecord, totals: yearTotals }) => (
                          <div key={yearRecord.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                                <p className="text-xs text-slate-500">{yearRecord.startDate} to {yearRecord.endDate}</p>
                              </div>
                              <span
                                className={`badge badge-outline ${STATUS_BADGE_CLASS[yearRecord.status.toLowerCase()] || 'border-slate-200 bg-slate-50 text-slate-700'}`}
                              >
                                {yearRecord.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="rounded border border-slate-100 bg-slate-50 p-2">
                                <p className="text-[11px] text-slate-500">Budget</p>
                                <p className="text-xs font-semibold text-slate-900">{formatMoney(yearTotals.approved)}</p>
                              </div>
                              <div className="rounded border border-slate-100 bg-slate-50 p-2">
                                <p className="text-[11px] text-slate-500">Remaining</p>
                                <p className={`text-xs font-semibold ${yearTotals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {formatMoney(yearTotals.variance)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="form-label text-slate-900">Assigned Staff</label>
                                <select
                                  className="select"
                                  value={yearRecord.assignedStaffId || ''}
                                  onChange={(event) => handleAssignStaff(yearRecord.id, event.target.value)}
                                >
                                  <option value="">Unassigned</option>
                                  {staffMembers.map((staff) => (
                                    <option key={staff.id} value={staff.id}>
                                      {staff.name} ({staff.role})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-end">
                                <button
                                  type="button"
                                  className="btn btn-primary w-full"
                                  onClick={() => openBudgetEditor(template.id, yearRecord.id, yearRecord.financialYear)}
                                >
                                  Input Year Budget
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {!yearPrograms.length && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                            No program instances found for {selectedFinancialYear}.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {workspaceView === 'templates' && templatesTab === 'designer' && canAccessTemplateAdmin && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-500">
                          Template Designer: define labels and structure only (no amounts here).
                        </p>
                        <div className="flex items-center gap-2">
                          <button type="button" className="btn btn-sm btn-light" onClick={handleOpenTemplateModal}>
                            Create Template
                          </button>
                          <button type="button" className="btn btn-sm btn-primary" onClick={addOutcome}>
                            Add Outcome
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[11px] text-slate-500">Outcomes</p>
                          <p className="text-xs font-semibold text-slate-900">{selectedCounts?.outcomeCount ?? 0}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[11px] text-slate-500">Outputs</p>
                          <p className="text-xs font-semibold text-slate-900">{selectedCounts?.outputCount ?? 0}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[11px] text-slate-500">Activities</p>
                          <p className="text-xs font-semibold text-slate-900">{selectedCounts?.activityCount ?? 0}</p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[11px] text-slate-500">Budget Lines</p>
                          <p className="text-xs font-semibold text-slate-900">{selectedCounts?.budgetLineCount ?? 0}</p>
                        </div>
                      </div>
                      {designerNotice && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                          {designerNotice}
                        </div>
                      )}

                      {selectedTemplate.outcomes.map((outcome) => (
                        <div key={outcome.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center gap-2">
                            <input className="input" value={outcome.name} onChange={(event) => renameOutcome(outcome.id, event.target.value)} />
                            <button type="button" className="btn btn-sm btn-light" onClick={() => addOutput(outcome.id)}>Add Output</button>
                            <button type="button" className="btn btn-sm btn-light" onClick={() => removeOutcome(outcome.id)}>Remove</button>
                          </div>

                          {outcome.outputs.map((output) => (
                            <div key={output.id} className="mt-2 rounded border border-slate-100 bg-slate-50 p-2">
                              <div className="flex items-center gap-2">
                                <input className="input" value={output.name} onChange={(event) => renameOutput(outcome.id, output.id, event.target.value)} />
                                <button type="button" className="btn btn-sm btn-light" onClick={() => addActivity(outcome.id, output.id)}>Add Activity</button>
                                <button type="button" className="btn btn-sm btn-light" onClick={() => removeOutput(outcome.id, output.id)}>Remove</button>
                              </div>

                              <div className="mt-2 space-y-2">
                                {output.activities.map((activity) => (
                                  <div key={activity.id} className="rounded border border-slate-200 bg-white px-2 py-2">
                                    <div className="flex items-center gap-2">
                                      <input className="input" value={activity.name} onChange={(event) => renameActivity(outcome.id, output.id, activity.id, event.target.value)} />
                                      <button type="button" className="btn btn-sm btn-light" onClick={() => addBudgetLine(outcome.id, output.id, activity.id)}>Add Budget Line</button>
                                      <button type="button" className="btn btn-sm btn-light" onClick={() => removeActivity(outcome.id, output.id, activity.id)}>Remove</button>
                                    </div>

                                    <div className="mt-2 space-y-1">
                                      {activity.budgetLines.map((budgetLine) => (
                                        <div key={budgetLine.id} className="flex items-center gap-2">
                                          <input className="input" value={budgetLine.name} onChange={(event) => renameBudgetLine(outcome.id, output.id, activity.id, budgetLine.id, event.target.value)} />
                                          <button type="button" className="btn btn-sm btn-light" onClick={() => removeBudgetLine(outcome.id, output.id, activity.id, budgetLine.id)}>Remove</button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {workspaceView === 'templates' && templatesTab === 'structure' && canAccessTemplateAdmin && (
                    <div className="space-y-2">
                      {!selectedYearRecord ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                          Select a year in Annual Programs to view budget structure totals.
                        </div>
                      ) : (
                        <>
                          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                            <p className="text-xs text-slate-500">Project Total Budget ({selectedYearRecord.financialYear})</p>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Approved</p><p className="text-xs font-semibold text-slate-900">{formatMoney(selectedProjectTotals?.approved ?? 0)}</p></div>
                              <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Actual</p><p className="text-xs font-semibold text-slate-900">{formatMoney(selectedProjectTotals?.actual ?? 0)}</p></div>
                              <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Variance</p><p className={`text-xs font-semibold ${(selectedProjectTotals?.variance ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(selectedProjectTotals?.variance ?? 0)}</p></div>
                            </div>
                          </div>

                          {selectedTemplate.outcomes.map((outcome) => {
                            const outcomeTotals = getOutcomeTotals(outcome, selectedYearRecord.id);
                            return (
                              <details key={outcome.id} className="rounded-lg border border-slate-200 p-3" open>
                                <summary className="cursor-pointer text-sm font-semibold text-slate-900">{outcome.name}</summary>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Outcome Approved</p><p className="text-xs font-semibold text-slate-900">{formatMoney(outcomeTotals.approved)}</p></div>
                                  <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Outcome Actual</p><p className="text-xs font-semibold text-slate-900">{formatMoney(outcomeTotals.actual)}</p></div>
                                  <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Outcome Variance</p><p className={`text-xs font-semibold ${outcomeTotals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(outcomeTotals.variance)}</p></div>
                                </div>

                                <div className="mt-2 space-y-2 ps-3 border-s-2 border-slate-200">
                                  {outcome.outputs.map((output) => {
                                    const outputTotals = getOutputTotals(output, selectedYearRecord.id);
                                    return (
                                      <details key={output.id} className="rounded border border-slate-100 p-2" open>
                                        <summary className="cursor-pointer text-xs font-semibold text-slate-800">{output.name}</summary>
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                          <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Output Approved</p><p className="text-xs font-semibold text-slate-900">{formatMoney(outputTotals.approved)}</p></div>
                                          <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Output Actual</p><p className="text-xs font-semibold text-slate-900">{formatMoney(outputTotals.actual)}</p></div>
                                          <div className="rounded border border-slate-100 bg-slate-50 p-2"><p className="text-[11px] text-slate-500">Output Variance</p><p className={`text-xs font-semibold ${outputTotals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(outputTotals.variance)}</p></div>
                                        </div>

                                        <div className="mt-2 ps-3 border-s-2 border-slate-200 space-y-1">
                                          {output.activities.map((activity) => {
                                            const activityTotals = getActivityTotals(activity, selectedYearRecord.id);
                                            return (
                                              <div key={activity.id} className="rounded bg-slate-50 px-2 py-2 space-y-1">
                                                <div className="flex items-center justify-between gap-3">
                                                  <p className="text-xs font-semibold text-slate-800">{activity.name}</p>
                                                  <p className="text-[11px] text-slate-500">{activity.budgetLines.length} budget lines</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                  <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Activity Approved</p><p className="text-xs font-semibold text-slate-900">{formatMoney(activityTotals.approved)}</p></div>
                                                  <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Activity Actual</p><p className="text-xs font-semibold text-slate-900">{formatMoney(activityTotals.actual)}</p></div>
                                                  <div className="rounded border border-slate-100 bg-white p-2"><p className="text-[11px] text-slate-500">Activity Variance</p><p className={`text-xs font-semibold ${activityTotals.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatMoney(activityTotals.variance)}</p></div>
                                                </div>

                                                <div className="space-y-1">
                                                  {activity.budgetLines.map((budgetLine) => (
                                                    <div key={budgetLine.id} className="rounded border border-slate-200 bg-white px-2 py-1 flex items-center justify-between">
                                                      <span className="text-xs text-slate-700">{budgetLine.name}</span>
                                                      <span className="text-xs font-semibold text-slate-900">{formatMoney(calculateBudgetLineAmount(getBudgetInput(selectedYearRecord.id, budgetLine.id)))}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              </details>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <Dialog open={yearModalOpen} onOpenChange={setYearModalOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="px-5 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">Create New Year</DialogTitle>
          </DialogHeader>

          <form className="p-5 space-y-4" onSubmit={handleCreateYear}>
            {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="form-label text-slate-900">Template</label>
                <select className="select" value={formTemplateId} onChange={(event) => setFormTemplateId(event.target.value)}>
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option value={template.id} key={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-slate-900">Financial Year</label>
                <input className="input" type="number" value={financialYear} min={2020} max={2100} onChange={(event) => setFinancialYear(Number(event.target.value))} />
              </div>

              <div>
                <label className="form-label text-slate-900">Start Date</label>
                <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>

              <div>
                <label className="form-label text-slate-900">End Date</label>
                <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              This creates the new year structure. Budget values are entered separately in Input Year Budget.
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-light" onClick={() => setYearModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create Year'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="px-5 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">Create Template</DialogTitle>
          </DialogHeader>

          <form className="p-5 space-y-4" onSubmit={handleCreateTemplate}>
            {templateFormError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {templateFormError}
              </div>
            )}

            <div>
              <label className="form-label text-slate-900">Template Name</label>
              <input
                className="input"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="e.g. 2027 Disability Inclusion"
              />
            </div>

            <div>
              <label className="form-label text-slate-900">Description</label>
              <textarea
                className="textarea"
                rows={4}
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="Describe what this template is for."
              />
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              The template is created empty. You can then add outcomes, outputs, activities, and budget lines.
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-light" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creatingTemplate}>
                {creatingTemplate ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={budgetEditorOpen} onOpenChange={closeBudgetEditor}>
        {budgetEditorContext && budgetEditorTemplate && (
          <SheetContent side="right" className="w-full sm:max-w-5xl p-0 overflow-y-auto">
            <SheetHeader className="px-5 py-4 border-b border-slate-100">
              <SheetTitle className="text-base font-semibold text-slate-900">Year Budget Editor</SheetTitle>
              <p className="text-xs text-slate-500 mt-1">
                {budgetEditorTemplate.name} - {budgetEditorContext.financialYear}
              </p>
            </SheetHeader>

            <div className="p-5 space-y-4">
              {budgetEditorTemplate.outcomes.map((outcome) => (
                <div key={outcome.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Outcome: {outcome.name}</p>

                  {outcome.outputs.map((output) => (
                    <div key={output.id} className="rounded border border-slate-100 bg-slate-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-800">Output: {output.name}</p>

                      {output.activities.map((activity) => (
                        <div key={activity.id} className="rounded border border-slate-200 bg-white p-3 space-y-2">
                          <p className="text-xs font-semibold text-slate-900">Activity: {activity.name}</p>

                          {activity.budgetLines.map((line) => {
                            const current = budgetDraft[line.id] || emptyBudgetInput(line.id);
                            return (
                              <div key={line.id} className="rounded border border-slate-100 p-2 space-y-2">
                                <p className="text-xs font-semibold text-slate-800">{line.name}</p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                  <input className="input" type="number" min={0} value={current.quantity} placeholder="Quantity" onChange={(event) => updateBudgetDraftField(line.id, 'quantity', Number(event.target.value))} />
                                  <input className="input" type="number" min={0} value={current.frequency} placeholder="Frequency" onChange={(event) => updateBudgetDraftField(line.id, 'frequency', Number(event.target.value))} />
                                  <input className="input" type="number" min={0} value={current.unitCost} placeholder="Unit Cost" onChange={(event) => updateBudgetDraftField(line.id, 'unitCost', Number(event.target.value))} />
                                  <input className="input" type="number" min={0} value={current.units} placeholder="Units" onChange={(event) => updateBudgetDraftField(line.id, 'units', Number(event.target.value))} />
                                  <input className="input" type="number" min={0} value={current.actualAmount} placeholder="Actual" onChange={(event) => updateBudgetDraftField(line.id, 'actualAmount', Number(event.target.value))} />
                                </div>
                                <p className="text-xs text-slate-600">
                                  Amount = quantity x frequency x unit cost x units = <span className="font-semibold text-slate-900">{formatMoney(calculateBudgetLineAmount(current))}</span>
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button type="button" className="btn btn-light" onClick={() => closeBudgetEditor(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveBudgetDraft} disabled={submitting}>{submitting ? 'Saving...' : 'Save Year Budget'}</button>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </Container>
  );
};

export { ProjectsPage };
