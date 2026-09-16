import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DataGrid,
  DataGridColumnHeader,
  KeenIcon,
  Menu,
  MenuIcon,
  MenuItem,
  MenuLink,
  MenuSeparator,
  MenuSub,
  MenuTitle,
  MenuToggle,
  TDataGridRequestParams,
} from '@/components';
import { ColumnDef } from '@tanstack/react-table';
import { useApolloClient, useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { useSearchParams } from 'react-router-dom';
import {
  GET_REQUISITIONS,
  GET_REQUISITION,
  SAVE_REQUISITION,
  DELETE_REQUISITION,
  UPDATE_REQUISITION_STATUS,
} from '@/gql/requisitions';
import { toast } from 'sonner';
import { RequisitionFormSheet } from '../sheets/RequisitionFormSheet';
import { RequisitionDetailSheet } from '../sheets/RequisitionDetailSheet';
import { toFriendlyErrorMessage } from '@/utils';

export const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(value || 0);

export type RequisitionStatus =
  | 'Draft'
  | 'Pending'
  | 'Pending'
  | 'Accepted'
  | 'Approved'
  | 'Rejected'
  | 'Amendment Requested'
  | 'Amended'
  | 'Closed';

export type RequisitionItem = {
  id: string;
  budgetLineId?: string | null;
  description: string;
  quantity: number;
  frequency: number;
  unitCost: number;
  units: string;
  amount: number;
};

export type RequisitionRecord = {
  id: string;
  requisitionNo: string;
  programId: string;
  outcomeId?: string | null;
  outputId?: string | null;
  activityId?: string | null;
  requestedBy: {
    id: string;
    email: string;
    name: string;
    staffDetails?: { signature?: string | null } | null;
  };
  title: string;
  purpose?: string | null;
  conceptNote?: string | null;
  conceptNoteName?: string | null;
  rejectionReason?: string | null;
  reason?: string | null;
  status: RequisitionStatus | string;
  totalRequestedAmount: number;
  createdAt: string;
  items: RequisitionItem[];
  program?: { id: string; name: string } | null;
  outcome?: { id: string; name: string } | null;
  output?: { id: string; name: string } | null;
  activity?: { id: string; name: string } | null;
};

const RequisitionsList = ({
  createOpen = false,
  onCreateOpenChange,
  onExportReady,
  canEdit,
  canAddBudgetLines,
}: {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  onExportReady?: (fn: () => void, state: { loading: boolean }) => void;
  canEdit?: boolean;
  canAddBudgetLines?: boolean;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPageData, setCurrentPageData] = useState<RequisitionRecord[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const pageSize = 10;

  const statusBadge: Record<string, string> = {
    Pending: 'border-slate-200 bg-slate-50 text-slate-700',
    Accepted: 'border-blue-200 bg-blue-50 text-blue-700',
    Approved: 'border-green-200 bg-green-50 text-green-700',
    Rejected: 'border-rose-200 bg-rose-50 text-rose-700',
    'Amendment Requested': 'border-amber-200 bg-amber-50 text-amber-700',
    Closed: 'border-slate-300 bg-slate-200 text-slate-700',
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Declarative query — runs on mount and whenever `variables` change.
  // `refetch` gives us an imperative, Promise-returning escape hatch for
  // the DataGrid's pagination callback, without abandoning useQuery.
  const {
    data: requisitionsData,
    loading: fetching,
    error: queryError,
    refetch,
  } = useQuery<{ requisitions: RequisitionRecord[] }>(GET_REQUISITIONS, {
    variables: {
      limit: pageSize,
      offset: 0,
      search: debouncedSearch || undefined,
    },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  // Keep local mirrors in sync whenever Apollo's cache/query state changes
  // (e.g. from the initial mount, or from refetchQueries after a save/delete).
  useEffect(() => {
    if (queryError) {
      setCurrentPageData([]);
      setFetchError(toFriendlyErrorMessage(queryError, 'We could not load requisitions. Please try again.'));
      return;
    }
    const items = requisitionsData?.requisitions || [];
    setCurrentPageData(items);
    setFetchError(null);
  }, [requisitionsData, queryError]);

  const [saveRequisition] = useMutation(SAVE_REQUISITION, {
    awaitRefetchQueries: true,
    refetchQueries: [
      {
        query: GET_REQUISITIONS,
        variables: {
          limit: pageSize,
          offset: 0,
          search: debouncedSearch || undefined,
        },
      },
    ],
  });

  const handleSave = useCallback(
    async (values: Record<string, any>, id?: string | null) => {
      setSaving(true);
      try {
        const payload: any = {
          id: id || values?.id || null,
          programId: values?.projectYearId,
          outcomeId: values?.outcomeId || null,
          outputId: values?.outputId || null,
          activityId: values?.activityId || null,
          title: values?.title || '',
          purpose: values?.purpose || '',
          status: values?.status || 'Draft',
          items: (values?.items || []).map((item: any) => ({
            id: item.id || null,
            budgetLineId: item.budgetLineId,
            description: item.description,
            quantity: item.quantity,
            frequency: item.frequency,
            unitCost: item.unitCost,
            units: item.units,
          })),
        };

        if (values?.conceptNote) {
          payload.conceptNote = values.conceptNote;
        }

        await saveRequisition({ variables: { input: payload } });

        setRefreshKey((prev) => prev + 1);
        setEditOpen(false);
        if (onCreateOpenChange) onCreateOpenChange(false);
        toast.success(`Requisition ${id ? 'updated' : 'created'} successfully!`);
      } catch (error: any) {
        toast.error(toFriendlyErrorMessage(error, 'Unable to save this requisition. Please try again.'));
      } finally {
        setSaving(false);
      }
    },
    [saveRequisition, onCreateOpenChange]
  );

  // Bridges the DataGrid's imperative pagination contract onto refetch().
  // Still hits the network via useQuery's own client instance — no separate
  // client.query() call, no useQuery-inside-a-callback violation.
  const fetchRequisitionsPage = useCallback(
    async ({ pageIndex, pageSize: gridPageSize }: TDataGridRequestParams) => {
      try {
        const { data } = await refetch({
          limit: gridPageSize,
          offset: pageIndex * gridPageSize,
          search: debouncedSearch || undefined,
        });

        const items = data?.requisitions || [];
        setCurrentPageData(items);
        setFetchError(null);

        return {
          data: items,
          totalCount: pageIndex * gridPageSize + items.length + (items.length === gridPageSize ? 1 : 0),
        };
      } catch (error: any) {
        setCurrentPageData([]);
        setFetchError(toFriendlyErrorMessage(error, 'We could not load requisitions. Please try again.'));

        return {
          data: [],
          totalCount: 0,
        };
      }
    },
    [refetch, debouncedSearch]
  );

  // ... deleteRequisition, updateStatus, handleStatusChange, handleExport unchanged ...
  const [deleteRequisition, { loading: deleting }] = useMutation(DELETE_REQUISITION, {
    onCompleted: () => {
      toast.success('Requisition deleted successfully');
      setRefreshKey((prev) => prev + 1);
    },
    onError: (err) => {
      toast.error(toFriendlyErrorMessage(err, 'Unable to delete this requisition. Please try again.'));
    },
  });

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm('Are you sure you want to delete this requisition?')) {
        deleteRequisition({ variables: { id } });
      }
    },
    [deleteRequisition]
  );

  const [updateStatus, { loading: updatingStatus }] = useMutation(UPDATE_REQUISITION_STATUS, {
    onCompleted: (_, context) => {
      toast.success('Requisition status updated');
      setRefreshKey((prev) => prev + 1);
      const updatedId = context?.variables?.id;
      if (updatedId && detailRow?.id === updatedId) {
        setDetailOpen(false);
      }
    },
    onError: (err) => {
      toast.error(toFriendlyErrorMessage(err, 'Unable to update requisition status. Please try again.'));
    },
  });

  const handleStatusChange = useCallback(
    (id: string, status: RequisitionStatus, reason?: string) => {
      updateStatus({ variables: { id, status, reason: reason || undefined } });
    },
    [updateStatus]
  );

  const handleExport = useCallback(() => {
    if (!currentPageData?.length) {
      toast.error('No data to export');
      return;
    }
    const rows: RequisitionRecord[] = currentPageData;
    const headers = ['Requisition No', 'Program', 'Status', 'Requested By', 'Total Amount', 'Created'];

    const csvLines = rows.map((row) => {
      const cells = [
        row.requisitionNo || '',
        row.program?.name || '',
        row.status || '',
        row.requestedBy?.name || '',
        String(row.totalRequestedAmount ?? ''),
        row.createdAt || '',
      ];
      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...csvLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'requisitions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentPageData]);

  useEffect(() => {
    if (onExportReady) {
      onExportReady(handleExport, { loading: fetching });
    }
  }, [fetching, handleExport, onExportReady]);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<RequisitionRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<RequisitionRecord | null>(null);
  const data = useMemo<RequisitionRecord[]>(() => [], []);

  // Deep-link support: a notification (or any other external link) can send
  // the user here with ?open=<id> to jump straight to that requisition's
  // detail sheet, without depending on which page of the grid it's on.
  const [searchParams, setSearchParams] = useSearchParams();
  const [fetchRequisitionById] = useLazyQuery<{ requisition: RequisitionRecord | null }>(GET_REQUISITION);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;

    fetchRequisitionById({ variables: { id: openId } }).then(({ data: openData }) => {
      if (openData?.requisition) {
        setDetailRow(openData.requisition);
        setDetailOpen(true);
      } else {
        toast.error('That requisition could not be found.');
      }
    });

    setSearchParams(
      (prev) => {
        prev.delete('open');
        return prev;
      },
      { replace: true }
    );
    // Only ever meant to run once for the ?open= param present on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const columns = useMemo<ColumnDef<RequisitionRecord>[]>(
    () => [
      {
        accessorKey: 'requisitionNo',
        header: ({ column }) => <DataGridColumnHeader title="Requisition No" column={column} />,
        cell: ({ row }) => <span className="text-sm text-gray-900">{row.original.requisitionNo}</span>,
      },
      {
        accessorKey: 'program',
        header: ({ column }) => <DataGridColumnHeader title="Program" column={column} />,
        cell: ({ row }) => <span className="text-sm text-gray-700">{row.original.program?.name || '—'}</span>,
      },
      {
        accessorKey: 'requestedBy',
        header: ({ column }) => <DataGridColumnHeader title="Requested By" column={column} />,
        cell: ({ row }) => <span className="text-sm text-gray-700">{row.original.requestedBy?.name || '—'}</span>,
      },
      {
        accessorKey: 'totalRequestedAmount',
        header: ({ column }) => <DataGridColumnHeader title="Total" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{formatMoney(row.original.totalRequestedAmount)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
        cell: ({ row }) => (
          <span className={`badge badge-outline ${statusBadge[row.original.status] }`}>
                 {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Menu className="items-stretch justify-end">
            <MenuItem
              toggle="dropdown"
              trigger="click"
              dropdownProps={{
                placement: 'bottom-end',
              }}
            >
              <MenuToggle className="btn btn-sm btn-icon btn-light btn-clear">
                <KeenIcon icon="dots-vertical" />
              </MenuToggle>

              <MenuSub className="menu-default" rootClassName="w-full max-w-[200px]">
                <MenuItem
                  onClick={() => {
                    setDetailRow(row.original);
                    setDetailOpen(true);
                  }}
                >
                  <MenuLink>
                    <MenuIcon>
                      <KeenIcon icon="eye" />
                    </MenuIcon>
                    <MenuTitle>View</MenuTitle>
                  </MenuLink>
                </MenuItem>

                {canEdit && row.original.status === 'Pending' && (
                  <>
                    <MenuItem
                      onClick={() => {
                        setEditRow(row.original);
                        setEditOpen(true);
                      }}
                    >
                      <MenuLink>
                        <MenuIcon>
                          <KeenIcon icon="pencil" />
                        </MenuIcon>
                        <MenuTitle>Edit</MenuTitle>
                      </MenuLink>
                    </MenuItem>

                    <MenuSeparator />

                    <MenuItem
                      onClick={() => {
                        if (!deleting) {
                          handleDelete(row.original.id);
                        }
                      }}
                    >
                      <MenuLink className="text-danger">
                        <MenuIcon>
                          <KeenIcon icon="trash" />
                        </MenuIcon>
                        <MenuTitle>{deleting ? 'Deleting...' : 'Delete'}</MenuTitle>
                      </MenuLink>
                    </MenuItem>
                  </>
                )}
              </MenuSub>
            </MenuItem>
          </Menu>
        ),
      },
    ],
    [handleDelete, deleting, canEdit]
  );

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-[-0.01em] text-[#172550] sm:text-lg">Requisitions</h2>
          <p className="mt-1 text-xs text-slate-500">Review, search, and manage submitted requests.</p>
        </div>

        <label className="relative block w-full shrink-0 sm:max-w-sm">
          <span className="sr-only">Search requisitions</span>
          <KeenIcon icon="magnifier" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search requisitions"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input h-10 w-full pl-9"
          />
        </label>
      </div>

      {fetchError && (
        <div className="alert alert-danger mx-4 mt-4 sm:mx-5" role="alert">
          <div className="text-sm">{fetchError}</div>
          <button type="button" className="btn btn-xs btn-light" onClick={() => setRefreshKey((prev) => prev + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="[&_[data-container]]:rounded-none [&_[data-container]]:border-x-0 [&_[data-container]]:border-t-0 [&_[data-pagination]]:border-t [&_[data-pagination]]:border-slate-100 [&_[data-pagination]]:bg-slate-50/40 [&_[data-pagination]]:px-4 [&_[data-pagination]]:py-4 sm:[&_[data-pagination]]:px-5">
        <DataGrid
          key={`${refreshKey}-${debouncedSearch}`}
          columns={columns}
          data={data}
          serverSide={true}
          onFetchData={fetchRequisitionsPage}
          pagination={{ size: pageSize, sizes: [10, 20, 50] }}
          messages={{
            empty: fetchError
              ? 'Failed to load requisitions'
              : debouncedSearch
                ? 'No requisitions match your search.'
                : 'No requisitions available.',
          }}
        />
      </div>

      <RequisitionFormSheet
        open={createOpen}
        onOpenChange={onCreateOpenChange || (() => {})}
        onSave={(vals) => handleSave(vals)}
        saving={saving}
        canAddBudgetLines={canAddBudgetLines}
      />
      <RequisitionFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={editRow}
        onSave={(vals) => handleSave(vals, editRow?.id)}
        saving={saving}
        canAddBudgetLines={canAddBudgetLines}
      />
      <RequisitionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        detailRow={detailRow}
        canEdit={canEdit}
        updatingStatus={updatingStatus}
        onStatusChange={handleStatusChange}
      />
    </section>
  );
};

export { RequisitionsList };
