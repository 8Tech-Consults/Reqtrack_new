import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { LOAD_USERS, ROLES } from "@/gql/queries";
import { CREATE_USER, DELETE_USER } from "@/gql/mutations";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from "@/layouts/demo1/toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toAbsoluteUrl, toFriendlyErrorMessage } from "@/utils";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridColumnHeader,
  DataGridRowSelect,
  DataGridRowSelectAll,
  TDataGridRequestParams,
  useDataGrid,
  KeenIcon,
} from "@/components";
import { Column, ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { URL_2 } from "@/config/urls";

type User = {
  id: string | number;
  username: string;
  name?: string;
  phone_number?: string;
  premises_location?: string;
  email?: string;
  district?: string;
  image?: string | null;
  role_id?: string;
  role_name?: string | null;
  created_at?: string;
};

type LoadUsersResponse = {
  users: User[];
  usersCount: number;
};

type LoadUsersVariables = {
  limit?: number;
  offset?: number;
  search?: string;
  roleName?: string;
  district?: string;
};

type RolesResponse = {
  roles: { id: string | number; name: string }[];
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return toFriendlyErrorMessage(error, fallback);
};

const UserFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  loading,
  initialValues,
  rolesOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: any) => void;
  loading: boolean;
  initialValues?: (Partial<User> & { password?: string }) | null;
  rolesOptions: { id: string | number; name: string }[];
}) => {
  const [form, setForm] = useState({
    id: "",
    username: "",
    name: "",
    phone_number: "",
    premises_location: "",
    email: "",
    district: "",
    imageFile: null as File | null,
    previewUrl: "",
    password: "",
    roleId: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setShowPassword(false);
      setForm({
        id: String(initialValues?.id ?? ""),
        username: initialValues?.username ?? "",
        name: initialValues?.name ?? "",
        phone_number: initialValues?.phone_number ?? "",
        premises_location: initialValues?.premises_location ?? "",
        email: initialValues?.email ?? "",
        district: initialValues?.district ?? "",
        imageFile: null,
        previewUrl: initialValues?.image
          ? `${URL_2}/imgs/${initialValues.image}`
          : "",
        password: "",
        roleId: "",
      });
      const initRole = (initialValues as any)?.role_name;
      const initRoleName = Array.isArray(initRole)
        ? initRole[0]
        : typeof initRole === "string"
          ? initRole
          : "";
      if (initRoleName) {
        const match = rolesOptions.find((r) => r.name === initRoleName);
        if (match) setForm((prev) => ({ ...prev, roleId: String(match.id) }));
      }
    }
  }, [open, initialValues, rolesOptions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      id: form.id ? String(form.id) : null,
      username: form.username,
      name: form.name,
      phone_number: form.phone_number,
      premises_location: form.premises_location,
      email: form.email,
      district: form.district,
      password: form.password || undefined,
    };
    if (form.imageFile) {
      payload.image = form.imageFile;
    }
    if (form.roleId) {
      payload.role_id = String(form.roleId);
    }
    onSubmit({ payload });
  };

  const isEditing = !!form.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[840px] lg:max-w-[800px]"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>{isEditing ? "Edit User" : "Create User"}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="h-full flex flex-col"
          style={{
            height: "calc(100vh - 75px)",
            overflow: "auto",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Username
              </label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Name
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required={!isEditing}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required={!isEditing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Phone Number
              </label>
              <Input
                type="tel"
                value={form.phone_number}
                onChange={(e) =>
                  setForm({ ...form, phone_number: e.target.value })
                }
                required={!isEditing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                District
              </label>
              <Input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                required={!isEditing}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Premises location
              </label>
              <Input
                value={form.premises_location}
                onChange={(e) =>
                  setForm({ ...form, premises_location: e.target.value })
                }
                required={!isEditing}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setForm((prev) => ({
                    ...prev,
                    imageFile: file,
                    previewUrl: url,
                  }));
                }}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                required={!isEditing}
              />
              {form.previewUrl && (
                <img
                  src={form.previewUrl}
                  alt="Preview"
                  className="mt-2 h-20 w-20 rounded-md object-cover"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Role
              </label>
              <Select
                value={form.roleId}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, roleId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {rolesOptions.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditing && form.roleId && (
                <div className="mt-1 text-xs text-gray-600">
                  Selected role:
                  <span className="badge badge-sm ml-2">
                    {rolesOptions.find(
                      (r) => String(r.id) === String(form.roleId),
                    )?.name || "—"}
                  </span>
                </div>
              )}
            </div>
            {/* {!isEditing && ( */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!isEditing}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <KeenIcon icon={showPassword ? "eye-slash" : "eye"} />
                </button>
              </div>
            </div>
            {/* )} */}
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : isEditing
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

const UserPreviewDialog = ({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}) => {
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Preview User</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex items-start gap-4">
            <img
              src={
                user.image
                  ? `${URL_2}/imgs/${user.image}`
                  : toAbsoluteUrl("/media/avatars/blank.png")
              }
              alt={user.username}
              className="size-14 rounded-full object-cover"
            />
            <div className="space-y-1">
              <div className="text-base font-semibold text-gray-900">
                {user.username}
              </div>
              <div className="text-sm text-gray-700">
                {user.name}
              </div>
              <div className="text-sm text-gray-700">{user.email}</div>
              <div className="text-sm text-gray-700">{user.district}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {user.role_name ? (
                  <span className="badge badge-sm">{user.role_name}</span>
                ) : null}
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

const UsersListPage = () => {
  const apolloClient = useApolloClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { data: rolesData, loading: rolesLoading, error: rolesError } = useQuery<RolesResponse>(ROLES);
  const [createUser, { loading: saving }] = useMutation(CREATE_USER);
  const [deleteUser] = useMutation(DELETE_USER);

  const rolesOptions = useMemo(
    () =>
      (rolesData?.roles || []).map((r) => ({
        id: r.id,
        name: r.name,
      })),
    [rolesData],
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (params: TDataGridRequestParams) => {
      const searchFilter = params.columnFilters?.find(
        (entry) => entry.id === "user",
      )?.value;
      const roleFilter = params.columnFilters?.find(
        (entry) => entry.id === "role",
      )?.value;
      const districtFilter = params.columnFilters?.find(
        (entry) => entry.id === "district",
      )?.value;
      const search =
        typeof searchFilter === "string" && searchFilter.trim()
          ? searchFilter.trim()
          : undefined;
      const roleName =
        typeof roleFilter === "string" && roleFilter.trim()
          ? roleFilter.trim()
          : undefined;
      const district =
        typeof districtFilter === "string" && districtFilter.trim()
          ? districtFilter.trim()
          : undefined;

      try {
        const { data } = await apolloClient.query<
          LoadUsersResponse,
          LoadUsersVariables
        >({
          query: LOAD_USERS,
          variables: {
            limit: params.pageSize,
            offset: params.pageIndex * params.pageSize,
            search,
            roleName,
            district,
          },
          fetchPolicy: "network-only",
        });

        setFetchError(null);

        return {
          data: data?.users || [],
          totalCount: data?.usersCount || 0,
        };
      } catch (error) {
        setFetchError(
          getErrorMessage(error, "Failed to load users. Please try again."),
        );

        return {
          data: [],
          totalCount: 0,
        };
      }
    },
    [apolloClient],
  );

  const handleRefresh = () => {
    setFetchError(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };
  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      setDeletingId(String(user.id));
      await deleteUser({ variables: { userId: String(user.id) } });
      toast("User deleted");
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      toast("Failed to delete user", {
        description: getErrorMessage(e, "Unknown error"),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSubmit = async ({ payload }: { payload: any }) => {
    try {
      await createUser({ variables: { payload } });
      toast(payload?.id ? "User updated" : "User created");
      setIsFormOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      toast("Failed to save user", {
        description: getErrorMessage(e, "Unknown error"),
      });
    }
  };

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Users"
            description="Manage users and their roles"
          />
          <ToolbarActions>
            <button
              type="button"
 
              className="btn btn-sm btn-light"
              onClick={handleRefresh}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleCreate}
              disabled={rolesLoading}
            >
              New User
            </button>

            
            
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container className="py-0">
        {rolesError && (
          <div className="alert alert-danger mb-4">
            <div className="alert-title">Unable to load roles</div>
            <div className="text-sm text-gray-700">
              {getErrorMessage(rolesError, "Role options are unavailable.")}
            </div>
          </div>
        )}

        <UsersDataGrid
          key={refreshKey}
          onFetchData={fetchUsers}
          rolesOptions={rolesOptions}
          fetchError={fetchError}
          onRetry={handleRefresh}
          onPreview={(u) => setPreviewUser(u)}
          onEdit={(u) => handleEdit(u)}
          onDelete={(u) => handleDelete(u)}
          deletingId={deletingId}
        />
      </Container>

      <UserFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        loading={saving}
        initialValues={editingUser}
        rolesOptions={rolesOptions}
      />

      <UserPreviewDialog
        open={!!previewUser}
        onOpenChange={() => setPreviewUser(null)}
        user={previewUser}
      />
    </>
    // <div className="min-h-screen bg-gray-50">
    // </div>
  );
};

const UsersDataGrid = ({
  onFetchData,
  rolesOptions,
  fetchError,
  onRetry,
  onPreview,
  onEdit,
  onDelete,
  deletingId,
}: {
  onFetchData: (params: TDataGridRequestParams) => Promise<{
    data: User[];
    totalCount: number;
  }>;
  rolesOptions: { id: string | number; name: string }[];
  fetchError: string | null;
  onRetry: () => void;
  onPreview: (u: User) => void;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  deletingId: string | null;
}) => {
  const ColumnInputFilter = <TData, TValue>({
    column,
  }: {
    column: Column<TData, TValue>;
  }) => (
    <Input
      placeholder="Filter..."
      value={(column.getFilterValue() as string) ?? ""}
      onChange={(event) => column.setFilterValue(event.target.value)}
      className="h-9 w-full max-w-40"
    />
  );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: { headerClassName: "w-0" },
      },
      {
        accessorFn: (row: User) => row.username,
        id: "user",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Users"
            filter={<ColumnInputFilter column={column} />}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <img
              src={
                row.original.image
                  ? `${URL_2}/imgs/${row.original.image}`
                  : toAbsoluteUrl("/media/avatars/blank.png")
              }
              className="rounded-full size-8 shrink-0 object-cover"
              alt={row.original.username}
            />
            <div>
              <div className="text-sm font-semibold text-gray-800">{row.original.name}</div>
              <div className="text-xs text-gray-600">{`@${row.original.username}`}</div>
            </div>
          </div>
        ),
        meta: { className: "min-w-[240px]" },
      },
      {
        accessorFn: (row: User) => row.role_name || "",
        id: "role",
        header: ({ column }) => (
          <DataGridColumnHeader title="Role" column={column} />
        ),
        cell: ({ row }) => (
          <span className="badge badge-success shrink-0 badge-outline rounded-[30px]">
            {row.original.role_name}
          </span>
        ),
        meta: { className: "min-w-[300px]" },
      },
      {
        accessorFn: (row: User) => row.email,
        id: "email",
        header: ({ column }) => (
          <DataGridColumnHeader title="Email" column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-gray-800">{row.original.email}</span>
        ),
        meta: { className: "min-w-[180px]" },
      },
      {
        accessorFn: (row: User) => row.district,
        id: "district",
        header: ({ column }) => (
          <DataGridColumnHeader title="District" column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-gray-800">{row.original.district || "-"}</span>
        ),
        meta: { className: "min-w-[160px]" },
      },
      {
        id: "actions",
        header: () => "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <div className="inline-flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPreview(row.original)}
              >
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(row.original)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-danger/30 text-danger hover:bg-danger-light"
                onClick={() => onDelete(row.original)}
                disabled={String(deletingId) === String(row.original.id)}
              >
                {String(deletingId) === String(row.original.id)
                  ? "Deleting…"
                  : "Delete"}
              </Button>
            </div>
          </div>
        ),
        meta: { headerClassName: "w-[220px]" },
      },
    ],
    [deletingId],
  );

  const HeaderToolbar = () => {
    const { table, totalRows, loading } = useDataGrid();
    const [searchInput, setSearchInput] = useState("");
    const [districtInput, setDistrictInput] = useState("");
    const roleValue =
      ((table.getColumn("role")?.getFilterValue() as string) || "").trim() ||
      "all";

    const clearFilters = () => {
      setSearchInput("");
      setDistrictInput("");
      table.getColumn("user")?.setFilterValue("");
      table.getColumn("role")?.setFilterValue("");
      table.getColumn("district")?.setFilterValue("");
      table.setPageIndex(0);
    };

    return (
      <div className="card-header flex-wrap gap-2 border-b-0 px-5">
        <h3 className="card-title font-medium text-sm">
          {loading ? "Loading users..." : `Showing ${totalRows} users`}
        </h3>
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <label className="input input-sm w-[220px]">
            <KeenIcon icon="magnifier" />
            <input
              type="text"
              placeholder="Search users"
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                table.getColumn("user")?.setFilterValue(val);
                table.setPageIndex(0);
              }}
            />
          </label>

          <Select
            value={roleValue}
            onValueChange={(value) => {
              table.getColumn("role")?.setFilterValue(
                value === "all" ? "" : value,
              );
              table.setPageIndex(0);
            }}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {rolesOptions.map((role) => (
                <SelectItem key={String(role.id)} value={role.name}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="input input-sm w-[170px]">
            <input
              type="text"
              placeholder="District"
              value={districtInput}
              onChange={(e) => {
                const val = e.target.value;
                setDistrictInput(val);
                table.getColumn("district")?.setFilterValue(val);
                table.setPageIndex(0);
              }}
            />
          </label>

          {/* <Button  className="btn btn-sm btn-light"  variant="outline" size="sm" onClick={onRetry}>
            Export
          </Button> */}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>

          
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="alert alert-danger">
          <div className="alert-title">Failed to load users</div>
          <div className="text-sm text-gray-700">{fetchError}</div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <DataGrid<User>
        columns={columns}
        data={[]}
        rowSelection={true}
        serverSide={true}
        onFetchData={onFetchData}
        layout={{ card: true, cellSpacing: "xs", cellBorder: true }}
        toolbar={<HeaderToolbar />}
        pagination={{ size: 10, sizes: [10, 25, 50, 100] }}
        messages={{
          loading: "Loading users...",
          empty: "No users found",
        }}
      />
    </div>
  );
};

export { UsersListPage };
