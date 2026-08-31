import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText, Info, ListChecks, Clock, Printer, Receipt, ArrowRight } from 'lucide-react';
import { formatMoney, RequisitionRecord, RequisitionStatus } from '../blocks/RequisitionsList';
import { URL_2 } from '@/config/urls';
import { useAuthContext } from '@/auth';
import { getPermissionsFromToken } from '@/utils/permissions';
import { toAbsoluteUrl } from '@/utils';
import { LOAD_USERS } from '@/gql/queries';
import { GET_ACCOUNTABILITIES } from '@/gql/accountabilities';
import type { Accountability, AccountabilitiesVars } from '@/pages/accountabilities/accountability';
import { useQuery} from '@apollo/client/react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailRow?: RequisitionRecord | null;
  canEdit?: boolean;
  updatingStatus?: boolean;
  onStatusChange?: (id: string, status: RequisitionStatus, reason?: string) => void;
};

type RequisitionUser = {
  id: string;
  name: string;
  email?: string;
  staffDetails?: { signature?: string | null; role_name?: string | null } | null;
};

const statusBadge: Record<string, string> = {
  Pending: 'border-slate-200 bg-slate-50 text-slate-700',
  Accepted: 'border-blue-200 bg-blue-50 text-blue-700',
  Approved: 'border-green-200 bg-green-50 text-green-700',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  'Amendment Requested': 'border-amber-200 bg-amber-50 text-amber-700',
  Closed: 'border-slate-300 bg-slate-200 text-slate-700',
};

const RequisitionDetailSheet = ({ open, onOpenChange, detailRow, canEdit, updatingStatus, onStatusChange }: Props) => {
  const navigate = useNavigate();
  const [reasonText, setReasonText] = useState('');
  const [pendingAction, setPendingAction] = useState<RequisitionStatus | null>(null);

  const needsReason = pendingAction === 'Rejected' || pendingAction === ('Amendment Requested' as RequisitionStatus);

  const { auth } = useAuthContext();
  const { data, loading: usersLoading, error: usersError } = useQuery<{
    users: RequisitionUser[];
  }>(LOAD_USERS, {
    fetchPolicy: "network-only",
  });

  const users =data?.users;

  const perms = getPermissionsFromToken(auth?.access_token);

  const canCreateRequisitions = !!perms['can_create_requisitions'];
  const canAcceptRequisitions = !!perms['can_accept_requisitions'];
  const canApproveRequisitions = !!perms['can_approve_requisitions'];
  const canManageRequisitions = !!perms['can_manage_requisitions'];
  const canReviewAccountability = !!perms['can_manage_accountabilities'];

  const { data: accountabilityData } = useQuery<
    { accountabilities: Accountability[] },
    AccountabilitiesVars
  >(GET_ACCOUNTABILITIES, {
    variables: { requisitionId: detailRow?.id, limit: 1 },
    skip: !detailRow?.id,
    fetchPolicy: 'cache-and-network',
  });
  const accountability = accountabilityData?.accountabilities?.[0] ?? null;
  // Reviewers shouldn't be sent to an accountability that doesn't exist yet
  // or hasn't been submitted (Draft) — nothing there for them to act on.
  const hideAccountabilityForReviewer = canReviewAccountability && (!accountability || accountability.status === 'Draft');

  const handleAction = (status: RequisitionStatus) => {
    if (status === 'Rejected' || status === ('Amendment Requested' as RequisitionStatus)) {
      setPendingAction(status);
    } else {
      onStatusChange?.(detailRow!.id, status);
    }
  };

  const confirmAction = () => {
    if (!pendingAction || !detailRow) return;
    onStatusChange?.(detailRow.id, pendingAction, reasonText.trim() || undefined);
    setReasonText('');
    setPendingAction(null);
  };

  const cancelAction = () => {
    setReasonText('');
    setPendingAction(null);
  };

  const handlePrint = () => {
    let log: { action: string; reason?: string; by?: string; at?: string }[] = [];
    try { log = detailRow?.reason ? JSON.parse(detailRow.reason) : []; } catch { log = []; }
    
    // Build a lookup so we can resolve "by" (a user id) to a name/signature.
    // Swap `staffList` for whatever array of users/staff you already have loaded.
    const userMap = new Map(
      (users ?? []).map((u) => [u.id, u])
    );
    const resolveUser = (id?: string) => (id ? userMap.get(id) : undefined);

    const approvedEntry = log.filter((e) => e.action === 'Approved').pop();
    const rejectedEntry = log.filter((e) => e.action === 'Rejected').pop();
    const acceptedEntry = log.filter((e) => e.action === 'Accepted').pop();

    const approvedUser = resolveUser(approvedEntry?.by);
    const rejectedUser = resolveUser(rejectedEntry?.by);
    const acceptedUser = resolveUser(acceptedEntry?.by);

    // const approvedEntry = log.filter((e) => e.action === 'Approved').pop();
    // const rejectedEntry = log.filter((e) => e.action === 'Rejected').pop();

    const currency = (n: number) =>
      new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n);

    const itemsHtml = (detailRow?.items || []).map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.description}</td>
        <td>${item.quantity} ${item.units ?? ''}</td>
        <td>${item.frequency}</td>
        <td class="num">${currency(item.unitCost)}</td>
        <td class="num">${currency(item.amount)}</td>
      </tr>`).join('');

    const historyHtml = log.length ? log.map(e => `
      <tr>
        <td><span class="status-dot status-${e.action.toLowerCase()}"></span>${e.action}</td>
        <td>${e.by ?? '—'}</td>
        <td>${e.reason ?? '—'}</td>
        <td>${e.at ? new Date(e.at).toLocaleString('en-UG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      </tr>`).join('') : '';

    const totalFormatted = currency(detailRow?.totalRequestedAmount ?? 0);

    const statusClass = (detailRow?.status ?? '').toLowerCase().replace(/\s+/g, '-');
    const logoUrl = toAbsoluteUrl('media/logos/logo.png') ?? ''; // swap in a real URL or data URI

    const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8" />
      <title>Requisition ${detailRow?.requisitionNo}</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 32px; line-height: 1.4; }
        h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
        h2 { font-size: 13px; font-weight: 600; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #1e40af; }

        .letterhead { position: relative; text-align: center; padding-bottom: 12px; border-bottom: 2px solid #1e40af; margin-bottom: 16px; }
        .letterhead img { display: block; height: 48px; width: auto; object-fit: contain; margin: 0 auto 6px; }
        .org-name { font-size: 14px; font-weight: 700; color: #1e40af; }
        .org-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
        .letterhead .badge { position: absolute; top: 0; right: 0; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }

        .badge { display: inline-block; border-radius: 4px; padding: 3px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
        .badge.pending { border: 1px solid #fcd34d; background: #fffbeb; color: #b45309; }
        .badge.approved { border: 1px solid #86efac; background: #f0fdf4; color: #15803d; }
        .badge.rejected { border: 1px solid #fca5a5; background: #fef2f2; color: #b91c1c; }
        .badge.draft { border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .field { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; }
        .field label { display: block; font-size: 10px; color: #64748b; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.03em; }
        .field span { font-weight: 600; }
        .full { grid-column: 1 / -1; }

        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #eff6ff; text-align: left; padding: 7px 10px; font-weight: 600; border: 1px solid #dbeafe; }
        td { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
        td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
        tr:nth-child(even) td { background: #f8fafc; }
        tr { break-inside: avoid; }

        .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; }
        .status-approved .status-dot, .status-dot.status-approved { background: #22c55e; }
        .status-rejected .status-dot, .status-dot.status-rejected { background: #ef4444; }
        .status-pending .status-dot, .status-dot.status-pending { background: #f59e0b; }

        .total-row { display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 10px 14px; margin-top: 8px; font-weight: 700; font-size: 14px; break-inside: avoid; }
        .total-row .label { font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.03em; }

        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 40px; break-inside: avoid; }
        .sig-block { border-top: 1px solid #1e293b; padding-top: 8px; }
        .sig-block .name { font-weight: 600; min-height: 14px; }
        .sig-block .role { font-size: 10px; color: #64748b; }

        .footer { margin-top: 32px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }

        @media print {
          body { padding: 20px; }
          h2 { break-after: avoid; }
          thead { display: table-header-group; }
        }
      </style>
      </head>
      <body>
      <div class="letterhead">
        ${logoUrl ? `<img src="${logoUrl}" alt="Organization logo" />` : ''}
        <div class="org-name">Norwegian Association for Disabled Uganda</div>
        <div class="org-sub">Requisition & Accountability System</div>
        <span class="badge ${statusClass}">${detailRow?.status ?? ''}</span>
      </div>

      <div class="header">
        <div>
          <h1>${detailRow?.requisitionNo ?? ''}</h1>
          <div style="color:#475569;margin-top:2px">${detailRow?.title ?? ''}</div>
        </div>
      </div>

      <h2>Requisition Details</h2>
      <div class="grid">
        <div class="field"><label>Program</label><span>${detailRow?.program?.name ?? '—'}</span></div>
        <div class="field"><label>Activity</label><span>${detailRow?.activity?.name ?? '—'}</span></div>
        <div class="field"><label>Requested By</label><span>${detailRow?.requestedBy?.name ?? '—'}</span><div style="font-size:10px;color:#94a3b8">${detailRow?.requestedBy?.email ?? ''}</div></div>
        <div class="field"><label>Date Created</label><span>${detailRow?.createdAt ? new Date(detailRow.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></div>
        <div class="field full"><label>Purpose / Description</label><span>${detailRow?.purpose ?? '—'}</span></div>
      </div>

      <h2>Items</h2>
      <table>
        <thead><tr><th>No.</th><th>Item Description</th><th>Quantity</th><th>Frequency</th><th class="num">Unit Price (UGX)</th><th class="num">Total (UGX)</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="total-row"><span class="label">Total Requested Amount</span><span>${totalFormatted}</span></div>

      ${historyHtml ? `<h2>Approval History</h2><table><thead><tr><th>Action</th><th>By</th><th>Reason</th><th>Date &amp; Time</th></tr></thead><tbody>${historyHtml}</tbody></table>` : ''}

      <h2>Signatures</h2>
      <div class="signatures">
        <div>
          ${detailRow?.requestedBy?.staffDetails?.signature
            ? `<img src="${URL_2}/staff/${detailRow.requestedBy.staffDetails.signature}" alt="Signature" style="height:36px;max-width:140px;object-fit:contain;margin-bottom:4px" />`
            : `<div style="height:36px;border-bottom:1px solid #cbd5e1;margin-bottom:4px"></div>`
          }
          <div class="name">${detailRow?.requestedBy?.name ?? '___________________'}</div>
          <div class="role">Requested By</div>
          <div style="margin-top:6px;font-size:10px;color:#64748b">Date: _______________</div>
        </div>
        <div >
          ${acceptedUser?.staffDetails?.signature
            ? `<img src="${URL_2}/staff/${acceptedUser.staffDetails.signature}" alt="Signature" style="height:36px;max-width:140px;object-fit:contain;margin-bottom:4px" />`
            : `<div style="height:36px;border-bottom:1px solid #cbd5e1;margin-bottom:4px"></div>`
          }
          <div class="name">${acceptedUser?.name ?? '___________________'}</div>
          <div class="role">Reviewed By</div>
          <div style="margin-top:6px;font-size:10px;color:#64748b">Date: ${acceptedEntry?.at ? new Date(acceptedEntry.at).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' }) : '_______________'}</div>
        </div>
        <div >
          ${approvedUser?.staffDetails?.signature
            ? `<img src="${URL_2}/staff/${approvedUser.staffDetails.signature}" alt="Signature" style="height:36px;max-width:140px;object-fit:contain;margin-bottom:4px" />`
            : `<div style="height:36px;border-bottom:1px solid #cbd5e1;margin-bottom:4px"></div>`
          }
          <div class="name">${approvedUser?.name ?? (rejectedEntry ? rejectedUser?.name ?? '___________________' : '___________________')}</div>
          <div class="role">${rejectedEntry && !approvedEntry ? 'Rejected By' : 'Approved By'}</div>
          <div style="margin-top:6px;font-size:10px;color:#64748b">Date: ${approvedEntry?.at ? new Date(approvedEntry.at).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' }) : rejectedEntry?.at ? new Date(rejectedEntry.at).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' }) : '_______________'}</div>
        </div>
      </div>

      <div class="footer">
        <span>Generated ${new Date().toLocaleString('en-UG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        <span>${detailRow?.requisitionNo ?? ''}</span>
      </div>

      <script>
        window.onload = function() { window.print(); };
        window.onafterprint = function() { window.close(); };
      <\/script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (!detailRow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl h-full flex flex-col p-0">
          <div className="p-6 flex items-center justify-center h-full">
            <p className="text-slate-500">No data available</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl h-full flex flex-col p-0">
        <div className="p-6 border-b bg-slate-50/50">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <SheetTitle className="text-xl font-bold text-slate-900">{detailRow.requisitionNo}</SheetTitle>
                <SheetDescription className="mt-0.5">{detailRow.title}</SheetDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge badge-outline ${statusBadge[detailRow.status] ?? statusBadge.Pending}`}>
                  {detailRow.status}
                </span>
                <button
                  type="button"
                  title="Print requisition"
                  className="btn btn-sm btn-icon btn-light"
                  onClick={handlePrint}
                >
                  <Printer size={15} />
                </button>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* — Meta — */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b">
              <div className="p-1.5 bg-blue-50 rounded text-blue-600"><Info size={15} /></div>
              <h3 className="text-sm font-semibold text-slate-800">Requisition Details</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Program</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailRow.program?.name || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Requested By</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailRow.requestedBy?.name || '—'}</p>
                <p className="text-xs text-slate-400">{detailRow.requestedBy?.email}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Outcome</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailRow.outcome?.name || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Output</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailRow.output?.name || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Activity</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailRow.activity?.name || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs text-slate-500">Purpose / Description</p>
                <p className="text-slate-700 mt-0.5">{detailRow.purpose || '—'}</p>
              </div>
              {detailRow.conceptNoteName && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2 flex items-center gap-3">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Concept Note</p>
                    <a
                      href={`${URL_2}/concept_notes/${detailRow.conceptNoteName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline font-medium"
                    >
                      View Concept Note
                    </a>
                  </div>
                </div>
              )}
              {detailRow.rejectionReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
                  <p className="text-xs text-amber-600 font-medium">Reason</p>
                  <p className="text-sm text-amber-800 mt-0.5">{detailRow.rejectionReason}</p>
                </div>
              )}
              {/* <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Created</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {new Date(detailRow.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div> */}
            </div>
          </section>

          {/* — Items — */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-1 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded text-blue-600"><ListChecks size={15} /></div>
                <h3 className="text-sm font-semibold text-slate-800">Items</h3>
              </div>
              <span className="text-xs text-slate-500">{detailRow.items.length} item(s)</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-blue-50">
                    <th className="px-4 py-3 text-left font-semibold text-black">No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Item Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Quantity</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Frequency</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Unit Price (UGX)</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Total Price (UGX)</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {detailRow.items.map((item, index) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.quantity} {item.units}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.frequency}</td>
                      <td className="px-4 py-3 text-slate-600">{formatMoney(item.unitCost)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">Total Requested Amount</p>
              <p className="text-lg font-bold text-slate-900">{formatMoney(detailRow.totalRequestedAmount)}</p>
            </div>
          </section>

          

          {/* — Audit trail — */}
          {(() => {
            let log: { action: string; reason?: string; by?: string; at?: string }[] = [];
            try { log = detailRow.reason ? JSON.parse(detailRow.reason) : []; } catch { log = []; }
            let userMap: Record<string, string> = {};
            try { userMap = Object.fromEntries((users ?? []).map(u => [u.id, u.name])); } catch { userMap = {}; }
            if (!log.length) return null;
            const actionColour: Record<string, string> = {
              Approved: 'bg-green-500',
              Rejected: 'bg-rose-500',
              Pending: 'bg-blue-500',
              'Amendment Requested': 'bg-amber-500',
            };
            return (
              <section className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b">
                  <div className="p-1.5 bg-slate-100 rounded text-slate-500"><Clock size={15} /></div>
                  <h3 className="text-sm font-semibold text-slate-800">Approval History</h3>
                </div>
                <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                  {log.map((entry, i) => (
                    <li key={i} className="ml-4">
                      <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${actionColour[entry.action] ?? 'bg-slate-400'}`} />
                      <p className="text-xs font-semibold text-slate-800">{entry.action} by {entry.by ? userMap[entry.by] ?? entry.by : 'Unknown'}</p>
                      {entry.reason && <p className="text-xs text-slate-600 mt-0.5">{entry.reason}</p>}
                      {entry.at && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(entry.at).toLocaleString('en-UG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })()}

          {/* — Accountability — */}
          {(detailRow.status === 'Approved' || detailRow.status === 'Closed') && !hideAccountabilityForReviewer && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <div className="p-1.5 bg-blue-50 rounded text-blue-600"><Receipt size={15} /></div>
                <h3 className="text-sm font-semibold text-slate-800">Accountability</h3>
              </div>

              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                onClick={() => navigate(`/requisitions/${detailRow.id}/accountability`)}
              >
                <span className="text-sm text-slate-700">Manage accountability for this requisition</span>
                <ArrowRight size={16} className="text-slate-400" />
              </button>
            </section>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50">
          {/* — Approval — */}

          {/* {(canManageRequisitions && detailRow.status !!= 'Approved') && ( */}
          {((canAcceptRequisitions && ['Pending', 'Amended'].includes(detailRow.status)) ||
  (canApproveRequisitions && detailRow.status === 'Accepted')) && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <div className="p-1.5 bg-green-50 rounded text-green-600">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Approval</h3>
              </div>

              {pendingAction ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">
                    {pendingAction === 'Rejected' ? 'Provide a rejection reason:' : 'Describe what amendments are needed:'}
                  </p>
                  <textarea
                    className="textarea textarea-bordered w-full text-sm"
                    rows={3}
                    placeholder="Enter reason..."
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" className="btn btn-sm btn-light" onClick={cancelAction}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${pendingAction === 'Rejected' ? 'btn-danger' : 'btn-warning'}`}
                      onClick={confirmAction}
                      disabled={updatingStatus || !reasonText.trim()}
                    >
                      {updatingStatus ? 'Saving...' : `Confirm ${pendingAction}`}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-2">
                  {/* <button
                    type="button"
                    className="btn btn-light w-full"
                    onClick={() => handleAction('Pending')}
                    disabled={updatingStatus || detailRow.status === 'Pending'}
                  >
                    Submit
                  </button> */}
                  <button
                    type="button"
                    className="btn btn-success w-full"
                    onClick={() => handleAction(canAcceptRequisitions ? 'Accepted' : 'Approved')}
                    disabled={updatingStatus || detailRow.status === 'Approved'}
                  >
                    {canAcceptRequisitions && detailRow.status === 'Pending' ? 'Accept' : 'Approve'}
                    {/* Approve */}
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning w-full"
                    onClick={() => handleAction('Amendment Requested' as RequisitionStatus)}
                    disabled={updatingStatus || detailRow.status === 'Amendment Requested'}
                  >
                    Request Amendment
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger w-full"
                    onClick={() => handleAction('Rejected')}
                    disabled={updatingStatus || detailRow.status === 'Rejected'}
                  >
                    Reject
                  </button>
                </div>
              )}
            </section>
          )}
          {/* <button
            type="button"
            className="w-full btn btn-light"
            onClick={() => { cancelAction(); onOpenChange(false); }}
          >
            Close
          </button> */}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export { RequisitionDetailSheet };

