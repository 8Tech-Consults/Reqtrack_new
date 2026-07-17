import { db } from "../../config/config.js";
import { GraphQLError } from "graphql";
import saveData from "../../utils/db/saveData.js";
import { JSONResolver } from "graphql-scalars";
import tryParseJSON from "../../helpers/tryParseJSON.js";
import checkPermission from "../../helpers/checkPermission.js";
import { v4 as uuidv4 } from "uuid";
import requireAnyPermission from "../../helpers/requireAnyPermission.js";

export const getRoles = async ({ id, role_name }) => {
  try {
    let values = [];
    let where = "";

    if (id || id === 0) {
      where += " AND r.id = ?";
      values.push(id);
    }

    if (role_name) {
      where += " AND r.name = ?";
      values.push(role_name);
    }
    let sql = `SELECT r.* FROM roles AS r WHERE deleted = 0 ${where} ORDER BY r.id DESC`;

    const [results] = await db.execute(sql, values);

    return results;
  } catch (error) {
    console.log("error", error);
     throw new Error(`Failed to fetch seed labels: ${error.message}`);
    // throw new GraphQLError("Error fetching roles");
  }
};

const roleResolvers = {
  JSON: JSONResolver,
  Query: {
    roles: async (parent, args, context) => {
      // const userPermissions = context.req.user.permissions;
      // checkPermission(
      //   userPermissions,
      //   "can_view_roles",
      //   "You dont have permissions to view roles"
      // );

      const result = await getRoles({});

      const res = result.map((role) => ({
        ...role,
        permissions: tryParseJSON(tryParseJSON(role.permissions)),
      }));

      return res;
    },
  },
  Mutation: {
    saveRole: async (parent, args, context) => {
      // requireAnyPermission(
      //   context,
      //   ["can_manage_roles", "can_create_roles"],
      //   "You do not have permission to save roles.",
      // );
      try {
        const { id, role_name, description } = args.payload;

        const data = {
          name: role_name,
          description: description || null,
        };
        if (!id) {
          data.id = uuidv4();
        }

        const save_id = await saveData({
          table: "roles",
          data,
          id,
          idColumn: "id",
        });

        return {
          success: true,
          message: id
            ? "Role updated successfully"
            : "Role Created Successfully",
          data: {
            id: save_id,
            name: role_name,
            description,
          },
        };
      } catch (error) {
        console.log("error", error);
        throw new GraphQLError(error.message);
      }
    },
    deleteRole: async (parent, args, context) => {
      requireAnyPermission(
        context,
        ["can_manage_roles", "can_delete_roles"],
        "You do not have permission to delete roles.",
      );
      try {
        const { role_id } = args;

        const [[assignment]] = await db.execute(
          "SELECT COUNT(*) AS assigned_users FROM users WHERE role_id = ? AND deleted = 0",
          [role_id],
        );
        if (Number(assignment?.assigned_users || 0) > 0) {
          throw new GraphQLError(
            "This role is assigned to active users. Reassign them before deleting the role.",
            { extensions: { code: "BAD_USER_INPUT" } },
          );
        }

        // await softDelete({
        //   table: "roles",
        //   id: role_id,
        //   idColumn: "role_id",
        // });

        // delete the role
        let sql = "DELETE FROM roles WHERE id = ?";
        let values = [role_id];

        await db.execute(sql, values);

        return {
          success: true,
          message: "Role deleted successfully",
        };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },
    updateRolePermissions: async (parent, args, context) => {
      // requireAnyPermission(
      //   context,
      //   ["can_manage_roles", "can_update_role_permissions"],
      //   "You do not have permission to update role permissions.",
      // );
      try {
        const { role_id, permissions } = args.payload;

        const data = {
          permissions: JSON.stringify(permissions),
        };

        const save_id = await saveData({
          table: "roles",
          data,
          id: role_id,
          idColumn: "id",
        });

        return {
          success: true,
          message: "Permissions Saved Successfully",
        };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },
  },
};

export default roleResolvers;
