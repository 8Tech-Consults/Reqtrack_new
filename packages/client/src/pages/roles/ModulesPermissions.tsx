import { Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { MODULES_CONFIG, type ModuleConfig } from "./permissions.config";
import { Button } from "@/components/ui/button";
import { UPDATE_ROLE_PERMISSIONS } from "@/gql/mutations";
import { ROLES } from "@/gql/queries";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { toFriendlyErrorMessage } from "@/utils";

type TPermissionsState = Record<string, boolean>;

const ModulesPermissions = ({ selectedRole }: { selectedRole: any }) => {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<TPermissionsState>({});
  const [initialPermissions, setInitialPermissions] =
    useState<TPermissionsState>({});

  const [updatePermissions, { loading: saving }] = useMutation(
    UPDATE_ROLE_PERMISSIONS,
    {
      refetchQueries: [{ query: ROLES }],
      awaitRefetchQueries: true,
    },
  );

  useEffect(() => {
    // Seed from API: permissions is an array of objects [{permId: true}, ...]
    const initial: TPermissionsState = {};
    if (selectedRole?.permissions && Array.isArray(selectedRole.permissions)) {
      for (const entry of selectedRole.permissions as Array<
        Record<string, boolean>
      >) {
        if (entry && typeof entry === "object") {
          for (const [permId, isTrue] of Object.entries(entry)) {
            if (isTrue) initial[permId] = true;
          }
        }
      }
    }
    setPermissions(initial);
    setInitialPermissions(initial);
  }, [selectedRole?.id]);

  const handlePermissionToggle = (moduleId: string, permissionId: string) => {
    const key = `${permissionId}`;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = (module: ModuleConfig) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const p of module.permissions) next[`${p.id}`] = true;
      return next;
    });
  };

  const handleClearAll = (module: ModuleConfig) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const p of module.permissions) delete next[`${p.id}`];
      return next;
    });
  };

  const currentEnabled = Object.keys(permissions).filter((k) => permissions[k]);
  const initialEnabled = Object.keys(initialPermissions).filter(
    (k) => initialPermissions[k],
  );
  const isDirty =
    currentEnabled.sort().join("|") !== initialEnabled.sort().join("|");

  const onSave = async () => {
    try {
      const enabled = Object.entries(permissions)
        .filter(([, v]) => !!v)
        .map(([k]) => k);
      const unique = Array.from(new Set(enabled));
      const permissionsPayload = unique.map(
        (permId) => ({ [permId]: true }) as Record<string, boolean>,
      );

      await updatePermissions({
        variables: {
          payload: {
            role_id: String(selectedRole.id),
            permissions: permissionsPayload,
          },
        },
      });

      setInitialPermissions({ ...permissions });
      toast("Permissions updated", {
        description: `${unique.length} permissions saved.`,
      });
    } catch (e: any) {
      toast("Failed to update permissions", {
        description: toFriendlyErrorMessage(e, "Unable to update permissions. Please try again."),
      });
    }
  };

  if (!selectedRole) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex">
        <div className="flex items-center justify-center h-full w-full">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Select a Role
            </h3>
            <p className="text-base font-medium text-gray-700">
              Choose a role to view its modules and permissions
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {selectedRole.name} - Permissions
        </h2>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-4">
          {MODULES_CONFIG.map((module) => {
            const Icon = module.icon;
            const isExpanded = expandedModuleId === module.id;

            return (
              <div
                key={module.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedModuleId(isExpanded ? null : module.id)
                  }
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-gray-600" />
                    <span className="font-medium text-gray-900">
                      {module.name}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="pt-4 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Permissions
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectAll(module)}
                          className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => handleClearAll(module)}
                          className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2">
                      {module.permissions.map((p) => {
                        const key = `${p.id}`;
                        const checked = !!permissions[key];
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                              checked
                                ? "bg-green-50 border-green-200 text-green-800"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                              checked={checked}
                              onChange={() =>
                                handlePermissionToggle(module.id, p.id)
                              }
                            />
                            <span className="text-[15px] font-medium">
                              {p.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-gray-200 bg-white sticky bottom-0">
        <div className="flex justify-end">
          <Button
            variant="default"
            size="lg"
            disabled={!isDirty || saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export { ModulesPermissions };
