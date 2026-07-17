import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { ModulesPermissions } from "./ModulesPermissions";
import AddRoleDialog from "./blocks/AddRoleDialog";
import { useMutation, useQuery } from "@apollo/client/react";
import { ROLES } from "@/gql/queries";
import { ADD_ROLE, DELETE_ROLE } from "@/gql/mutations";
import { Container } from "@/components/container";
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from "@/layouts/demo1/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { toFriendlyErrorMessage } from "@/utils";

type Role = {
  id: string | number;
  name: string;
  description?: string;
  permissions?: any;
};

const RolesList = ({
  roles,
  selectedRole,
  onRoleSelect,
  onAddRole,
  onEditRole,
  onDeleteRole,
  deletingRoleId,
}: {
  roles: Role[];
  selectedRole: Role | null;
  onRoleSelect: (r: Role) => void;
  onAddRole: () => void;
  onEditRole: (r: Role) => void;
  onDeleteRole: (r: Role) => void;
  deletingRoleId: string | null;
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
      <div className="px-6 py-2 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Roles</h2>

        <a href="#" className="btn btn-sm btn-primary" onClick={onAddRole}>
          <Plus size={16} />
          Add Role
        </a>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {roles?.map((role) => (
            <div
              key={role.id}
              onClick={() => onRoleSelect(role)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRole?.id === role.id
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-semibold text-gray-900 text-md">
                    {role.name}
                  </h5>
                  <p className="text-sm text-gray-600 font-medium mt-1">
                    {role.description}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-light btn-sm"
                    onClick={() => onEditRole(role)}
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    className="btn btn-light btn-sm text-danger"
                    onClick={() => onDeleteRole(role)}
                    disabled={String(deletingRoleId) === String(role.id)}
                  >
                    <Trash2 size={14} />
                    {String(deletingRoleId) === String(role.id)
                      ? "Deleting…"
                      : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RolesListSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
    <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-24" />
    </div>
    <div className="p-6 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-gray-200">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60 mt-2" />
        </div>
      ))}
    </div>
  </div>
);

const PermissionsSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
    <div className="px-6 py-3 border-b border-gray-200">
      <Skeleton className="h-5 w-48" />
    </div>
    <div className="p-4 space-y-3 flex-1 overflow-y-auto">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4">
          <Skeleton className="h-4 w-56" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
    <div className="px-4 py-3 border-t">
      <Skeleton className="h-10 w-24 ml-auto" />
    </div>
  </div>
);

const RolesListPage = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [resetForm, setResetForm] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const { loading, error, data } = useQuery<any>(ROLES);

  const [addRole, { loading: savingRole }] = useMutation(ADD_ROLE, {
    refetchQueries: [{ query: ROLES }],
    awaitRefetchQueries: true,
  });
  const [deleteRole] = useMutation(DELETE_ROLE, {
    refetchQueries: [{ query: ROLES }],
    awaitRefetchQueries: true,
  });

  const roles = (data?.roles || []) as Role[];

  useEffect(() => {
    if (!selectedRole) return;
    const updated = roles.find((r) => String(r.id) === String(selectedRole.id));
    if (updated) setSelectedRole(updated);
  }, [data?.roles]);

  if (loading)
    return (
      // <div className="min-h-screen bg-gray-50">
      <>
        {/* <Container>
          <Toolbar>
            <ToolbarHeading
              title="Roles"
              description="Manage system roles and their permission"
            />
            <ToolbarActions></ToolbarActions>
          </Toolbar>
        </Container> */}
        <Container>
          <div className="grid grid-cols-1 lg:[grid-template-columns:360px_1fr] gap-6 h-[calc(100vh-200px)] overflow-hidden">
            <RolesListSkeleton />
            <PermissionsSkeleton />
          </div>
        </Container>
        </>
      // </div>
    );

  if (error) return <div>Error loading roles</div>;

  const handleRoleSelect = (role: Role) => setSelectedRole(role);

  const handleAddRole = () => {
    setEditingRole(null);
    setIsAddRoleDialogOpen(true);
    setResetForm(true);
    setTimeout(() => setResetForm(false), 0);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsAddRoleDialogOpen(true);
  };

  const handleDeleteRole = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      setDeletingRoleId(String(role.id));
      await deleteRole({
        variables: {
          roleId: role.id,
        },
      });
      toast("Role deleted");
      if (String(selectedRole?.id) === String(role.id)) setSelectedRole(null);
    } catch (e: any) {
      toast("Failed to delete role", {
        description: toFriendlyErrorMessage(e, "Unable to delete this role. Please try again."),
      });
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleAddRoleSubmit = async (roleData: Record<string, any>) => {
    try {
      const payload: any = {
        role_name: roleData.name,
        description: roleData.description,
      };
      if (editingRole?.id) payload.id = String(editingRole.id);

      await addRole({ variables: { payload } });
      toast(editingRole ? "Role updated" : "Role added");
      setIsAddRoleDialogOpen(false);
      setEditingRole(null);
    } catch (e: any) {
      toast("Failed to save role", {
        description: toFriendlyErrorMessage(e, "Unable to save this role. Please try again."),
      });
      setIsAddRoleDialogOpen(false);
    }
  };

  return (
    // <div className="min-h-screen bg-gray-50">
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Roles"
            description="Manage system roles and their permission"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid grid-cols-1 lg:[grid-template-columns:360px_1fr] gap-6 overflow-hidden">
          <RolesList
            roles={roles}
            selectedRole={selectedRole}
            onRoleSelect={handleRoleSelect}
            onAddRole={handleAddRole}
            onEditRole={handleEditRole}
            onDeleteRole={handleDeleteRole}
            deletingRoleId={deletingRoleId}
          />

          <ModulesPermissions selectedRole={selectedRole} />
        </div>
      </Container>
      <AddRoleDialog
        isOpen={isAddRoleDialogOpen}
        onClose={() => setIsAddRoleDialogOpen(false)}
        onSubmit={handleAddRoleSubmit}
        loading={savingRole}
        resetForm={resetForm}
        initialValues={
          editingRole
            ? { name: editingRole.name, description: editingRole.description }
            : null
        }
        title={editingRole ? "Edit Role" : "Add New Role"}
        submitLabel={editingRole ? "Save Changes" : "Add Role"}
      />
      </>
    // </div>
  );
};

export { RolesListPage };
