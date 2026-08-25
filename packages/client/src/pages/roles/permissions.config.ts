import { Route, ShieldCheck, Briefcase, FileText, User, Users } from "lucide-react";

export type PermissionItem = {
  id: string;
  label: string;
};

export type ModuleConfig = {
  id: string;
  name: string;
  icon: any;
  permissions: PermissionItem[];
};

export const MODULES_CONFIG: ModuleConfig[] = [
  
  {
    id: "projects",
    name: "Project Planning",
    icon: Route,
    permissions: [
      // { id: "can_manage_templates", label: "Can Manage Templates" },
      // { id: "can_edit_templates", label: "Can Edit Templates" },
      { id: "can_manage_programs", label: "Can Manage programs" },
      { id: "can_create_programs", label: "Can Create programs" },
      { id: "can_enter_budget", label: "Can Enter budgets" },
      { id: "can_edit_programs", label: "Can Edit programs" },
      { id: "can_delete_programs", label: "Can Delete programs" },
      { id: "can_view_programs", label: "Can View programs" },
      { id: "can_view_own_programs", label: "Can View Own programs" },
    ],
  },
  {
    id: "requisitions",
    name: "Requisition Workflow",
    icon: FileText,
    permissions: [
      { id: "can_manage_requisitions", label: "Can Manage Requisitions" },
      { id: "can_edit_requisitions", label: "Can Edit Requisitions" },
      { id: "can_delete_requisitions", label: "Can Delete Requisitions" },
      { id: "can_view_requisitions", label: "Can View Requisitions" },
      { id: "can_create_requisitions", label: "Can Create Requisitions" },
      { id: "can_view_own_requisitions", label: "Can View Own Requisitions" },
      { id: "can_approve_requisitions", label: "Can Approve Requisitions" },
      { id: "can_accept_requisitions", label: "Can Accept Requisitions" },
    ],
  },
  {
    id: "accountabilities",
    name: "Accountability & Oversight",
    icon: Briefcase,
    permissions: [
      { id: "can_manage_accountabilities", label: "Can Manage Accountabilities" },
      { id: "can_view_accountabilities", label: "Can View Accountabilities" },
      { id: "can_create_accountabilities", label: "Can Create Accountabilities" },
      { id: "can_edit_accountabilities", label: "Can Edit Accountabilities" },
      { id: "can_delete_accountabilities", label: "Can Delete Accountabilities" },
      { id: "can_view_own_accountabilities", label: "Can View Own Accountabilities" },
      { id: "can_approve_accountabilities", label: "Can Approve Accountabilities" },
    ],
  },
  {
    id: "staff",
    name: "Staff Management",
    icon: Users,
    permissions: [
      { id: "can_manage_staff", label: "Can Manage Staff" },
      { id: "can_view_staff", label: "Can View Staff" },
      { id: "can_create_staff", label: "Can Create Staff" },
      { id: "can_edit_staff", label: "Can Edit Staff" },
      { id: "can_delete_staff", label: "Can Delete Staff" },
    ],
  },
  {
    id: "system_configuration",
    name: "System Administration",
    icon: ShieldCheck,
    permissions: [
      { id: "can_create_users", label: "Can Create Users" },
      { id: "can_manage_users", label: "Can Manage Users" },
      { id: "can_manage_roles", label: "Can Manage Roles" },
      { id: "can_view_roles", label: "Can View Roles" },
      { id: "can_create_roles", label: "Can Create or Edit Roles" },
      { id: "can_delete_roles", label: "Can Delete Roles" },
      {
        id: "can_update_role_permissions",
        label: "Can Update Role Permissions",
      },
    ],
  },
];