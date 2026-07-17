import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(value);

type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

type RequisitionItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  program: string;
};

type RequisitionRecord = {
  id: string;
  requisitionNo: string;
  title: string;
  program: string;
  financialYear: number;
  requestedBy: string;
  status: RequisitionStatus;
  purpose: string;
  items: RequisitionItem[];
  createdAt: string;
  approvedBy?: string;
  reviewedBy?: string;
};

const seedRequisitions: RequisitionRecord[] = [
  {
    id: 'req-1',
    requisitionNo: 'REQ-2026-001',
    title: 'Teacher training materials',
    program: 'Disability Inclusion Program',
    financialYear: 2026,
    requestedBy: 'Grace Nansubuga',
    status: 'Submitted',
    purpose: 'Support Q1 teacher training workshops.',
    createdAt: '2026-01-12',
    items: [
      { id: 'req-1-item-1', description: 'Printing of training manuals', quantity: 1, unitCost: 800000, program: 'Disability Inclusion Program' },
      { id: 'req-1-item-2', description: 'Workshop stationery', quantity: 1, unitCost: 350000, program: 'Disability Inclusion Program' }
    ]
  },
  {
    id: 'req-2',
    requisitionNo: 'REQ-2026-002',
    title: 'District review meeting',
    program: 'Disability Inclusion Program',
    financialYear: 2026,
    requestedBy: 'Paul Kato',
    status: 'Approved',
    purpose: 'Coordinate district review meetings for planning.',
    createdAt: '2026-02-03',
    approvedBy: 'Finance Officer',
    items: [
      { id: 'req-2-item-1', description: 'Venue hire', quantity: 1, unitCost: 600000, program: 'Disability Inclusion Program' },
      { id: 'req-2-item-2', description: 'Meals and refreshments', quantity: 1, unitCost: 900000, program: 'Disability Inclusion Program' }
    ]
  },
  {
    id: 'req-3',
    requisitionNo: 'REQ-2026-003',
    title: 'Outreach clinic supplies',
    program: 'Community Rehabilitation Support',
    financialYear: 2026,
    requestedBy: 'Sarah Nakirya',
    status: 'Draft',
    purpose: 'Prepare supplies for the next mobile outreach clinic.',
    createdAt: '2026-03-08',
    items: [
      { id: 'req-3-item-1', description: 'Medical consumables', quantity: 1, unitCost: 1200000, program: 'Community Rehabilitation Support' }
    ]
  }
];

const RequisitionsPage = () => {
  const [requisitions, setRequisitions] = useState(seedRequisitions);
  const [selectedStatus, setSelectedStatus] = useState<RequisitionStatus | 'All'>('All');
  const [selectedYear, setSelectedYear] = useState<number | 'All'>('All');
  const [selectedProgram, setSelectedProgram] = useState<string>('All');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftPurpose, setDraftPurpose] = useState('');
  const [draftProgram, setDraftProgram] = useState('Disability Inclusion Program');
  const [draftYear, setDraftYear] = useState<number>(2026);
  const [formError, setFormError] = useState<string | null>(null);

  const programs = useMemo(() => Array.from(new Set(requisitions.map((item) => item.program))), [requisitions]);
  const years = useMemo(() => Array.from(new Set(requisitions.map((item) => item.financialYear))).sort((a, b) => b - a), [requisitions]);

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((item) => {
      const statusMatch = selectedStatus === 'All' || item.status === selectedStatus;
      const yearMatch = selectedYear === 'All' || item.financialYear === selectedYear;
      const programMatch = selectedProgram === 'All' || item.program === selectedProgram;
      return statusMatch && yearMatch && programMatch;
    });
  }, [requisitions, selectedProgram, selectedStatus, selectedYear]);

  const selectedRequisition = useMemo(
    () => requisitions.find((item) => item.id === selectedRequisitionId) || null,
    [requisitions, selectedRequisitionId]
  );

  const selectedTotal = useMemo(() => {
    if (!selectedRequisition) return 0;
    return selectedRequisition.items.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
  }, [selectedRequisition]);

  const openDetails = (requisitionId: string) => {
    setSelectedRequisitionId(requisitionId);
    setDetailsOpen(true);
  };

  const createRequisition = () => {
    setFormError(null);

    if (!draftTitle.trim()) {
      setFormError('Requisition title is required.');
      return;
    }

    const nextNumber = String(requisitions.length + 1).padStart(3, '0');
    const created: RequisitionRecord = {
      id: `req-${Date.now()}`,
      requisitionNo: `REQ-${draftYear}-${nextNumber}`,
      title: draftTitle.trim(),
      program: draftProgram,
      financialYear: draftYear,
      requestedBy: 'Current User',
      status: 'Draft',
      purpose: draftPurpose.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      items: []
    };

    setRequisitions((prev) => [created, ...prev]);
    setDraftTitle('');
    setDraftPurpose('');
    setDetailsOpen(false);
    setSelectedRequisitionId(created.id);
    setDetailsOpen(true);
  };

  const updateSelectedStatus = (status: RequisitionStatus) => {
    if (!selectedRequisitionId) return;
    setRequisitions((prev) =>
      prev.map((item) =>
        item.id === selectedRequisitionId
          ? {
              ...item,
              status,
              approvedBy: status === 'Approved' ? 'Admin Reviewer' : item.approvedBy,
              reviewedBy: status === 'Rejected' ? 'Admin Reviewer' : item.reviewedBy
            }
          : item
      )
    );
  };

  return (
    <div className="py-6 lg:py-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-slate-900">Requisitions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sidebar entry point for all requests. Each requisition can still be linked to a program year.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => setDetailsOpen(true)}>
          New Requisition
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <div className="card p-3">
          <p className="text-xs text-slate-500">Total Requests</p>
          <p className="text-lg font-semibold text-slate-900">{requisitions.length}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-500">Submitted</p>
          <p className="text-lg font-semibold text-slate-900">
            {requisitions.filter((item) => item.status === 'Submitted').length}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-500">Approved</p>
          <p className="text-lg font-semibold text-slate-900">
            {requisitions.filter((item) => item.status === 'Approved').length}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatMoney(requisitions.reduce((acc, item) => acc + item.items.reduce((sum, row) => sum + row.quantity * row.unitCost, 0), 0))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="select" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as RequisitionStatus | 'All')}>
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select className="select" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value === 'All' ? 'All' : Number(event.target.value))}>
          <option value="All">All Years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select className="select" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
          <option value="All">All Programs</option>
          {programs.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3">
        {filteredRequisitions.map((requisition) => (
          <button
            key={requisition.id}
            type="button"
            onClick={() => openDetails(requisition.id)}
            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{requisition.requisitionNo}</p>
                <p className="text-base font-medium text-slate-800 mt-1">{requisition.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {requisition.program} · {requisition.financialYear} · Requested by {requisition.requestedBy}
                </p>
              </div>
              <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">
                {requisition.status}
              </span>
            </div>
          </button>
        ))}

        {!filteredRequisitions.length && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No requisitions match the selected filters.
          </div>
        )}
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto bg-white">
          <SheetHeader className="text-left pb-2">
            <SheetTitle>Requisition Details Sheet</SheetTitle>
            <SheetDescription>
              Approval happens here inside the sheet, not in a dialog.
            </SheetDescription>
          </SheetHeader>

          {!selectedRequisition ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Create Requisition</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Start from the sidebar entry point and optionally tie the request to a program year.
                </p>
              </div>

              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="form-label text-slate-900">Title</label>
                  <input className="input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Request title" />
                </div>
                <div>
                  <label className="form-label text-slate-900">Purpose</label>
                  <textarea className="textarea" rows={3} value={draftPurpose} onChange={(event) => setDraftPurpose(event.target.value)} placeholder="Describe the request" />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label text-slate-900">Program</label>
                    <select className="select" value={draftProgram} onChange={(event) => setDraftProgram(event.target.value)}>
                      {programs.map((program) => (
                        <option key={program} value={program}>{program}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-slate-900">Financial Year</label>
                    <select className="select" value={draftYear} onChange={(event) => setDraftYear(Number(event.target.value))}>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="button" className="btn btn-primary w-full" onClick={createRequisition}>
                  Create Requisition
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">{selectedRequisition.requisitionNo}</p>
                      <h4 className="text-sm font-semibold text-slate-900">{selectedRequisition.title}</h4>
                    </div>
                    <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">
                      {selectedRequisition.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {selectedRequisition.program} · {selectedRequisition.financialYear}
                  </p>
                  <p className="text-sm text-slate-700 mt-3">{selectedRequisition.purpose}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">Items</h4>
                    <p className="text-xs text-slate-500">{selectedRequisition.items.length} item(s)</p>
                  </div>

                  {selectedRequisition.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                          <p className="text-xs text-slate-500 mt-1">Linked program: {item.program}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(item.quantity * item.unitCost)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Total Requested Amount</p>
                  <p className="text-xl font-semibold text-slate-900">{formatMoney(selectedTotal)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Approval</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Admin approval is handled directly in this sheet.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => updateSelectedStatus('Approved')}
                    disabled={selectedRequisition.status === 'Approved'}
                  >
                    Approve Requisition
                  </button>
                  <button
                    type="button"
                    className="btn btn-light w-full"
                    onClick={() => updateSelectedStatus('Submitted')}
                    disabled={selectedRequisition.status === 'Submitted'}
                  >
                    Mark as Submitted
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger w-full"
                    onClick={() => updateSelectedStatus('Rejected')}
                    disabled={selectedRequisition.status === 'Rejected'}
                  >
                    Reject Requisition
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">Details</p>
                  <p className="mt-2">Requested by: {selectedRequisition.requestedBy}</p>
                  <p>Created: {selectedRequisition.createdAt}</p>
                  {selectedRequisition.approvedBy && <p>Approved by: {selectedRequisition.approvedBy}</p>}
                  {selectedRequisition.reviewedBy && <p>Reviewed by: {selectedRequisition.reviewedBy}</p>}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export { RequisitionsPage };
