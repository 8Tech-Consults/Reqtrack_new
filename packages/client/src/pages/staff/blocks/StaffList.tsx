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
} from '@/components';
import { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery } from '@apollo/client/react';
import { GET_STAFF, SAVE_STAFF } from '@/gql/staff';
import { ROLES } from '@/gql/queries';
import { toast } from 'sonner';
import { StaffFormSheet } from '../sheets/StaffFormSheet';
import { StaffDetailSheet } from '../sheets/StaffDetailSheet';
import { toFriendlyErrorMessage } from '@/utils';

export type NextOfKinInfo = {
  name?: string;
  relationship?: string;
  phone?: string;
};

export type StaffRecord = {
  id: string;
  user_id?: string | null;
  name: string;
  role_name: string;
  staff_number: string;
  nin_number?: string | null;
  date_of_birth?: string | null;
  title?: string | null;
  contract_start?: string | null;
  contract_end?: string | null;
  telephone?: string | null;
  email: string;
  bank?: string | null;
  bank_account?: string | null;
  tin?: string | null;
  nssf?: string | null;
  marital_status?: string | null;
  next_of_kin?: string | NextOfKinInfo | null;
  profile_picture?: string | null;
  signature?: string | null;
};

export const parseNextOfKin = (value?: string | NextOfKinInfo | null): NextOfKinInfo => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initials = (name?: string) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

type RoleOption = { id: string | number; name: string };

const StaffList = ({
  createOpen = false,
  onCreateOpenChange,
  canEdit,
}: {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  canEdit?: boolean;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ getStaffs: StaffRecord[] }>(GET_STAFF, {
    fetchPolicy: 'network-only',
  });
  const { data: rolesData } = useQuery<{ roles: RoleOption[] }>(ROLES);

  const roleOptions = rolesData?.roles || [];
  const staffMembers = useMemo(() => data?.getStaffs || [], [data]);

  const filteredStaff = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return staffMembers;
    return staffMembers.filter((staff) =>
      [staff.name, staff.staff_number, staff.email, staff.telephone, staff.role_name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [staffMembers, searchTerm]);

  const [saveStaff] = useMutation(SAVE_STAFF, {
    refetchQueries: [{ query: GET_STAFF }],
    awaitRefetchQueries: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<StaffRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<StaffRecord | null>(null);

  const handleSave = useCallback(
    async (values: Record<string, any>) => {
      setSaving(true);
      try {
        await saveStaff({ variables: { input: values } });
        setEditOpen(false);
        if (onCreateOpenChange) onCreateOpenChange(false);
        toast.success(`Staff member ${values.id ? 'updated' : 'created'} successfully!`);
      } catch (err: any) {
        toast.error(toFriendlyErrorMessage(err, 'Unable to save this staff member. Please try again.'));
      } finally {
        setSaving(false);
      }
    },
    [saveStaff, onCreateOpenChange]
  );

  useEffect(() => {
    if (error) {
      toast.error(toFriendlyErrorMessage(error, 'We could not load staff. Please try again.'));
    }
  }, [error]);

  const columns = useMemo<ColumnDef<StaffRecord>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Staff" column={column} />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(row.original.name)}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{row.original.name}</div>
              <div className="text-xs text-gray-600">{row.original.staff_number}</div>
            </div>
          </div>
        ),
        meta: { className: 'min-w-[220px]' },
      },
      {
        accessorKey: 'role_name',
        header: ({ column }) => <DataGridColumnHeader title="Role" column={column} />,
        cell: ({ row }) => (
          <span className="badge badge-outline border-blue-200 bg-blue-50 text-blue-700">
            {row.original.role_name}
          </span>
        ),
      },
      {
        accessorKey: 'telephone',
        header: ({ column }) => <DataGridColumnHeader title="Contact" column={column} />,
        cell: ({ row }) => (
          <div>
            <div className="text-sm text-gray-800">{row.original.telephone || '—'}</div>
            <div className="text-xs text-gray-500">{row.original.email}</div>
          </div>
        ),
        meta: { className: 'min-w-[200px]' },
      },
      {
        accessorKey: 'contract',
        header: ({ column }) => <DataGridColumnHeader title="Contract Period" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">
            {formatDate(row.original.contract_start)} – {formatDate(row.original.contract_end)}
          </span>
        ),
        meta: { className: 'min-w-[200px]' },
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

                {canEdit && (
                  <>
                    <MenuSeparator />
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
                  </>
                )}
              </MenuSub>
            </MenuItem>
          </Menu>
        ),
      },
    ],
    [canEdit]
  );

  return (
    <div className="mb-8 bg-white p-6 rounded shadow">
      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          <div className="text-sm">Failed to load staff.</div>
          <button type="button" className="btn btn-xs btn-light" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search staff..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-bordered w-full max-w-xs"
        />
        {loading && <span className="text-xs text-gray-500">Loading staff...</span>}
      </div>

      <DataGrid
        columns={columns}
        data={filteredStaff}
        pagination={{ size: 10, sizes: [10, 20, 50] }}
        messages={{
          loading: 'Loading staff...',
          empty: searchTerm ? 'No staff match your search.' : 'No staff available.',
        }}
      />

      <StaffFormSheet
        open={createOpen}
        onOpenChange={onCreateOpenChange || (() => {})}
        onSave={(vals) => handleSave(vals)}
        saving={saving}
        roleOptions={roleOptions}
      />
      <StaffFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        initialValues={editRow}
        onSave={(vals) => handleSave(vals)}
        saving={saving}
        roleOptions={roleOptions}
      />
      <StaffDetailSheet open={detailOpen} onOpenChange={setDetailOpen} detailRow={detailRow} />
    </div>
  );
};

export { StaffList };
