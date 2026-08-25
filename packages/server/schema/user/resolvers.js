import { GraphQLError } from "graphql";
import { GraphQLDate, GraphQLDateTime } from "graphql-scalars";
import { db, PRIVATE_KEY } from "../../config/config.js";
import saveData from "../../utils/db/saveData.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";
import saveImage from "../../helpers/saveImage.js";
import tryParseJSON from "../../helpers/tryParseJSON.js";
import hasPermission from "../../helpers/hasPermission.js";
import { getRoles } from "../role/resolvers.js";
import { fetchStaff } from "../staff/resolvers.js";
import sendEmail from "../../utils/emails/email_server.js";

const ensureAnyPermission = (userPermissions, keys, message) => {
  const isAllowed = keys.some((key) => hasPermission(userPermissions, key));
  if (!isAllowed) {
    throw new GraphQLError(message);
  }
};

let userStatusColumnReady = false;

const ensureUserStatusColumn = async () => {
  if (userStatusColumnReady) {
    return;
  }

  const [columns] = await db.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'status'
     LIMIT 1`
  );

  if (!columns.length) {
    await db.execute(
      "ALTER TABLE users ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active' AFTER role_id"
    );
  }

  userStatusColumnReady = true;
};

const loginUser = async ({ email, password, user_id, context }) => {
  try {
    let values = [];
    let where = "";

    const identifier = String(email || "").trim();

    if (identifier) {
      where += " AND LOWER(users.email) = LOWER(?)";
      values.push(identifier);
    }

    if (user_id) {
      where += " AND users.id = ?";
      values.push(user_id);
    }

    let sql = `
          SELECT 
            users.*,
            roles.name as role_name,
            roles.permissions
          FROM users 
          LEFT JOIN roles ON roles.id = users.role_id
          WHERE users.deleted = 0 ${where}`;

    // let [results] = await db.execute(sql, values);
    const [results] = await db.execute(sql, values);

    const user = results[0];

    // console.log("user", results[0]);
    if (!user) throw new GraphQLError("Invalid email or password");

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new GraphQLError("Invalid email or password");

    const tokenData = {
      id: user.id,
      email: user?.email || null,
      must_change_password: Boolean(user?.must_change_password),
      permissions: tryParseJSON(tryParseJSON(user.permissions)),
    };

    const token = jwt.sign(tokenData, PRIVATE_KEY, {
      expiresIn: "1d",
    });

    context.res.setHeader("x-auth-token", `Bearer ${token}`);

    // Access the IP address from the context
    // const clientIpAddress = context.req.connection.remoteAddress;

    // using the role_id, to get the role of the user
    // const [role] = await getRoles({
    //   id: user.role_id,
    // });

    // if (!role) throw new GraphQLError("User has no role in the system!");

    return {
      success: true,
      message: "Login Successful",
      user: user,
      token,
    };
  } catch (error) {
    throw new GraphQLError(error.message);
  }
};

export const getUsers = async ({
  limit = 10,
  offset = 0,
  email,
  id,
  username,
  role_id,
  role_name,
  district,
  search,
}) => {
  try {
    let where = "WHERE users.deleted = 0";
    let values = [];

    if (email) {
      where += " AND users.email = ?";
      values.push(email);
    }

    if (id) {
      where += " AND users.id = ?";
      values.push(id);
    }

    if (username) {
      where += " AND users.username = ?";
      values.push(username);
    }

    if (role_id) {
      where += " AND users.role_id = ?";
      values.push(role_id);
    }

    if (role_name) {
      where += " AND roles.name = ?";
      values.push(role_name);
    }

    if (district) {
      where += " AND users.district LIKE ?";
      values.push(`%${district}%`);
    }

    if (search) {
      where +=
        " AND (users.username LIKE ? OR users.name LIKE ? OR users.email LIKE ?)";
      const q = `%${search}%`;
      values.push(q, q, q);
    }

    let sql = `
      SELECT 
       users.*,
       roles.name as role_name
      FROM users  
      LEFT JOIN roles ON roles.id = users.role_id
      ${where} ORDER BY users.updated_at DESC LIMIT ? OFFSET ?
    `;

    values.push(limit, offset);

    const [results] = await db.execute(sql, values);

    return results;
  } catch (error) {
    throw new GraphQLError(error.message);
  }
};

export const getUsersCount = async ({
  email,
  id,
  username,
  role_id,
  role_name,
  district,
  search,
}) => {
  try {
    let where = "WHERE users.deleted = 0";
    let values = [];

    if (email) {
      where += " AND users.email = ?";
      values.push(email);
    }

    if (id) {
      where += " AND users.id = ?";
      values.push(id);
    }

    if (username) {
      where += " AND users.username = ?";
      values.push(username);
    }

    if (role_id) {
      where += " AND users.role_id = ?";
      values.push(role_id);
    }

    if (role_name) {
      where += " AND roles.name = ?";
      values.push(role_name);
    }

    if (district) {
      where += " AND users.district LIKE ?";
      values.push(`%${district}%`);
    }

    if (search) {
      where +=
        " AND (users.username LIKE ? OR users.name LIKE ? OR users.email LIKE ?)";
      const q = `%${search}%`;
      values.push(q, q, q);
    }

    const sql = `
      SELECT COUNT(*) AS total
      FROM users
      LEFT JOIN roles ON roles.id = users.role_id
      ${where}
    `;

    const [results] = await db.execute(sql, values);
    return Number(results?.[0]?.total || 0);
  } catch (error) {
    throw new GraphQLError(error.message);
  }
};

// Light user/crop variety lookups
const fetchUserById = async (id) => {
  if (!id) return null;
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, image FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows.length) return null;
    const u = rows[0];
    return { id: String(u.id), name: u.name, email: u.email, image: u.image };
  } catch (e) {
    return null;
  }
};

const DU_AGENT_ROLE_ID = "44444444-4444-4444-4444-444444444444";
const DU_AGENT_ROLE_NAME = "DU Agent";
const DU_AGENT_ROLE_PERMISSIONS = [
  { can_view_pwds: true },
  { can_create_pwds: true },
  { can_view_du: true },
];


const userResolvers = {
  Date: GraphQLDate,
  Upload: GraphQLUpload,
  User: {
    staffDetails: async (parent) => {
      if (!parent?.id) return null;
      const [staff] = await fetchStaff({ id: parent.id, limit: 1 });
      return staff || null;
    },
  },
  Query: {
    users: async (_, args, context) => {
      // const userPermissions = context?.req?.user?.permissions;
      // ensureAnyPermission(
      //   userPermissions,
      //   ["can_manage_users", "can_create_users"],
      //   "You dont have permissions to view users"
      // );
      const limit = Number.isFinite(args?.limit)
        ? Math.max(1, Number(args.limit))
        : 10;
      const offset = Number.isFinite(args?.offset)
        ? Math.max(0, Number(args.offset))
        : 0;

      return await getUsers({
        limit,
        offset,
        role_name: args?.roleName || undefined,
        district: args?.district || undefined,
        search: args?.search || undefined,
      });
    },
    usersCount: async (_, args, context) => {
      // const userPermissions = context?.req?.user?.permissions;
      // ensureAnyPermission(
      //   userPermissions,
      //   ["can_manage_users", "can_create_users"],
      //   "You dont have permissions to view users"
      // );

      return await getUsersCount({
        role_name: args?.roleName || undefined,
        district: args?.district || undefined,
        search: args?.search || undefined,
      });
    },
    
    me: async (_, args, context) => {
      const user_id = context.req.user.id;

      const [results] = await getUsers({
        id: user_id,
      });

      return results || null;
    },
  },
  Mutation: {
    register: async (parent, args, context) => {
      const {
        id,
        username,
        name,
        staff_number,
        premises_location,
        phone_number,
        password,
        email,
        district,
      } = args.payload;

      try {
        await ensureUserStatusColumn();

        const normalizedUsername = String(username || "").trim();
        const normalizedEmail = String(email || "").trim().toLowerCase() || null;
        const normalizedPhone = String(phone_number || "").trim() || null;

        if (!normalizedUsername) {
          throw new GraphQLError("A phone number, email address, or username is required.");
        }

        if (normalizedEmail) {
          const users = await getUsers({
            email: normalizedEmail,
            limit: 1,
          });

          if (users[0] && !id)
            throw new GraphQLError("User email already exists!");
        }

        const [usernameExists] = await getUsers({
          username: normalizedUsername,
          limit: 1,
        });

        if (usernameExists && !id)
          throw new GraphQLError("Username already exists!");

        // generate unique password for employee
        const salt = await bcrypt.genSalt();
        const hashedPwd = await bcrypt.hash(password, salt);

        // Prefer the role naming in this project, but keep compatibility.
        let [basic_user] = await getRoles({
          role_name: "PWD",
        });

        if (!basic_user) {
          const [roles] = await db.execute(
            "SELECT * FROM roles WHERE deleted = 0 AND TRIM(TRAILING '.' FROM TRIM(name)) = ? LIMIT 1",
            ["PWD"]
          );
          basic_user = roles?.[0];
        }

        if (!basic_user) {
          [basic_user] = await getRoles({
            role_name: "Basic User",
          });
        }

        if (!basic_user) {
          throw new GraphQLError("Role is not yet defined.");
        }

        const data = {
          username: normalizedUsername,
          email: normalizedEmail,
          name,
          staff_number,
          premises_location,
          phone_number: normalizedPhone,
          password: hashedPwd,
          district: String(district || "").trim(),
          role_id: basic_user.id,
          status: "pending",
          created_at: new Date(),
          updated_at: new Date(),
        };

        if (!id) {
          data.id = uuidv4();
        }

        // then save in the db
        const save_id = await saveData({
          table: "users",
          data: data,
          id: id ? id : null,
        });

        return {
          success: true,
          message: "User Account created successfully",
          user: data,
        };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },
    createUser: async (parent, args, context) => {
      const {
        id,
        username,
        name,
        // company_initials,
        premises_location,
        phone_number,
        password,
        email,
        district,
        image,
        role_id,
        status,
      } = args.payload;

      const isUpdate = Boolean(id);
      let imageId;

      try {
        // const userPermissions = context?.req?.user?.permissions;
        // ensureAnyPermission(
        //   userPermissions,
        //   ["can_manage_users", "can_create_users"],
        //   "You dont have permissions to manage users"
        // );

        await ensureUserStatusColumn();

        const normalizedUsername = String(username || "").trim();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedName = String(name || "").trim();
        // const normalizedCompanyInitials = String(company_initials || "").trim();
        const normalizedPremisesLocation = String(premises_location || "").trim();
        const normalizedPhoneNumber = String(phone_number || "").trim() || null;
        const normalizedDistrict = String(district || "").trim();

        if (!normalizedUsername) {
          throw new GraphQLError("Username is required.");
        }
        if (!normalizedName) {
          throw new GraphQLError("Name is required.");
        }
        // if (!normalizedCompanyInitials) {
        //   throw new GraphQLError("Company initials are required.");
        // }
        if (!normalizedEmail) {
          throw new GraphQLError("Email is required.");
        }
        if (!normalizedDistrict) {
          throw new GraphQLError("District is required.");
        }
        if (!normalizedPremisesLocation) {
          throw new GraphQLError("Premises location is required.");
        }

        // Enforce unique email for new users
        if (!isUpdate) {
          const existing = await getUsers({ email: normalizedEmail, limit: 1 });
          if (existing[0]) throw new GraphQLError("User email already exists!");

          const [usernameExists] = await getUsers({
            username: normalizedUsername,
            limit: 1,
          });

          if (usernameExists && !id)
            throw new GraphQLError("Username already exists!");
        } else {
          const [existingByEmail] = await getUsers({
            email: normalizedEmail,
            limit: 1,
          });
          if (existingByEmail && String(existingByEmail.id) !== String(id)) {
            throw new GraphQLError("User email already exists!");
          }

          const [existingByUsername] = await getUsers({
            username: normalizedUsername,
            limit: 1,
          });
          if (existingByUsername && String(existingByUsername.id) !== String(id)) {
            throw new GraphQLError("Username already exists!");
          }
        }

        // For new users, password is required; for updates, skip password handling
        let hashedPwd;
        if (!isUpdate) {
          if (!password)
            throw new GraphQLError("Password is required for new users!");
          const salt = await bcrypt.genSalt();
          hashedPwd = await bcrypt.hash(password, salt);
        }

        // save user image
        if (image) {
          imageId = await saveImage({
            image,
          });
        }

        let resolvedRoleId = role_id;
        if (!resolvedRoleId) {
          let [defaultRole] = await getRoles({ role_name: "PWD" });
          if (!defaultRole) {
            [defaultRole] = await getRoles({ role_name: "Basic User" });
          }
          if (!defaultRole) {
            const [rows] = await db.execute(
              "SELECT id FROM roles WHERE deleted = 0 ORDER BY created_at ASC LIMIT 1"
            );
            defaultRole = rows?.[0] || null;
          }

          if (!defaultRole) {
            throw new GraphQLError("No active role found. Please create a role first.");
          }

          resolvedRoleId = defaultRole.id;
        }

        // Build data payload
        const data = {
          username: normalizedUsername,
          email: normalizedEmail,
          name: normalizedName,
          //staff_number: normalizedCompanyInitials,
          // premises_location: normalizedPremisesLocation,
          // phone_number: normalizedPhoneNumber,
          district: normalizedDistrict,
          role_id: resolvedRoleId,
          updated_at: new Date(),
        };

        if (status !== undefined) {
          data.status = status;
        }

        if (image) {
          data.image = imageId;
        }

        // Only set password and created_at on create
        if (!isUpdate) {
          data.password = hashedPwd;
          data.created_at = new Date();
          // Assign UUID if not supplied by DB
          data.id = uuidv4();
        } else {
          if (password && password !== "") {
            // if its an update and the password is provided, then update the password
            const salt = await bcrypt.genSalt();
            hashedPwd = await bcrypt.hash(password, salt);
            data.password = hashedPwd;
          }
        }

        // Persist
        await saveData({
          table: "users",
          data,
          id: isUpdate ? id : null,
        });

        return {
          success: true,
          message: isUpdate
            ? "User Account updated successfully"
            : "User Account created successfully",
          user: { id: isUpdate ? id : data.id, ...data },
        };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },
   
    updateUser: async (parent, args, context) => {
      // Validate user authentication/authorization first
      // if (!context.user) {
      //   throw new GraphQLError("Unauthorized - You must be logged in", {
      //     extensions: { code: "UNAUTHORIZED" },
      //   });
      // }

      // Check if the authenticated user has permission to update this user
      // (Add your specific authorization logic here)

      const {
        id,
        email,
        firstName,
        lastName,
        role,
        isActive,
        district,
        subcounty,
        school_id,
      } = args.payload;

      // Basic input validation
      if (!id) {
        throw new GraphQLError("User ID is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      let connection;
      try {
        const userPermissions = context?.req?.user?.permissions;
        ensureAnyPermission(
          userPermissions,
          ["can_manage_users", "can_create_users"],
          "You dont have permissions to update users"
        );

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if user exists
        const [user] = await getUsers({ id, limit: 1 });
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        console.log("Updating user:" )

        // Prepare update data
        const updateData = {
          email: email || user.email, // Keep existing if not provided
          name: firstName || user.name,
          last_name: lastName || user.last_name,
          role: role || user.role,
          is_active: isActive !== undefined ? isActive : user.is_active,
          district: district || user.district,
          subcounty: subcounty || user.subcounty,
          school_id: school_id || user.school_id,
          updated_at: new Date(),
        };

        // Validate email format if it's being updated
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new GraphQLError("Invalid email format", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Update user in database
        await saveData({
          table: "users",
          data: updateData,
          id,
          connection,
        });

        await connection.commit();

        return {
          success: true,
          message: "User account updated successfully",
        };
      } catch (error) {
        if (connection) {
          await connection.rollback();
        }

        // Handle specific database errors
        if (error.code === "ER_DUP_ENTRY") {
          throw new GraphQLError("Email already exists", {
            extensions: { code: "CONFLICT" },
          });
        }

        // Pass through GraphQL errors, wrap others
        if (error instanceof GraphQLError) {
          throw error;
        }

        console.error("Update user error:", error);
        throw new GraphQLError("Failed to update user", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      } finally {
        if (connection) {
          connection.release();
        }
      }
    },
    login: async (parent, args, context) => {
      const result = await loginUser({
        email: args.email,
        password: args.password,
        context,
      });

      return result;
    },
    changeMyPassword: async (_parent, args, context) => {
      const userId = context?.req?.user?.id;

      if (!userId) {
        throw new GraphQLError("Unauthorized");
      }

      const {newPassword } = args;

      if (!newPassword) {
        throw new GraphQLError("New password is required");
      }

      if (String(newPassword).length < 8) {
        throw new GraphQLError("Password must be at least 8 characters");
      }

      const [user] = await getUsers({ id: userId, limit: 1 });
      if (!user) {
        throw new GraphQLError("User not found");
      }

      const salt = await bcrypt.genSalt();
      const hashedPwd = await bcrypt.hash(newPassword, salt);

      await saveData({
        table: "users",
        id: userId,
        data: {
          password: hashedPwd,
          must_change_password: false,
          updated_at: new Date(),
        },
      });

      const freshUserResponse = await loginUser({
        user_id: userId,
        password: newPassword,
        context,
      });

      return {
        success: true,
        message: "Password changed successfully",
        token: freshUserResponse.token,
        user: freshUserResponse.user,
      };
    },
    resetPassword: async (parent, args, context) => {
      const { id, newPassword } = args; // Note: Fixed typo from newPasswordd to newPassword
      let connection;

      try {
        const userPermissions = context?.req?.user?.permissions;
        ensureAnyPermission(
          userPermissions,
          ["can_manage_users", "can_create_users"],
          "You dont have permissions to reset passwords"
        );

        // Authentication check
        // if (!context.user) {
        //   throw new GraphQLError("Unauthorized - You must be logged in", {
        //     extensions: { code: "UNAUTHORIZED" },
        //   });
        // }

        // Authorization - check if user has permission to reset this password
        // Option 1: Only allow users to reset their own password
        // if (context.user.id !== id && context.user.role !== 'ADMIN') {
        //   throw new GraphQLError("Unauthorized - You can only reset your own password", {
        //     extensions: { code: 'FORBIDDEN' },
        //   });
        // }

        // Option 2: Only allow admins to reset passwords
        // if (context.user.role !== 'ADMIN') {
        //   throw new GraphQLError("Unauthorized - Only admins can reset passwords", {
        //     extensions: { code: 'FORBIDDEN' },
        //   });
        // }

        // Input validation
        if (!id || !newPassword) {
          throw new GraphQLError("User ID and new password are required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        if (newPassword.length < 8) {
          throw new GraphQLError("Password must be at least 8 characters", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if user exists
        const [user] = await getUsers({ id, limit: 1 });
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt();
        const hashedPwd = await bcrypt.hash(newPassword, salt);

        // Update user password
        await saveData({
          table: "users",
          data: {
            password: hashedPwd,
            updated_at: new Date(),
          },
          id: id,
          connection: connection,
        });

        await connection.commit();

        // Invalidate all existing sessions/tokens for this user (recommended)
        // Implement your session invalidation logic here if needed

        return {
          success: true,
          message: "Password reset successfully",
        };
      } catch (error) {
        if (connection) {
          await connection.rollback();
        }

        // Handle specific errors
        if (error instanceof GraphQLError) {
          throw error;
        }

        console.error("Password reset error:", error);
        throw new GraphQLError("Failed to reset password", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      } finally {
        if (connection) {
          connection.release();
        }
      }
    },
    resetPasswordWithToken: async (parent, args, context) => {
      const { token, newPassword } = args;
      let connection;

      try {
        if (!token || !newPassword) {
          throw new GraphQLError("Token and new password are required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        if (newPassword.length < 8) {
          throw new GraphQLError("Password must be at least 8 characters", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, PRIVATE_KEY);
        } catch (err) {
          throw new GraphQLError("Invalid or expired reset token", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (!decoded?.id || decoded?.purpose !== "password_reset") {
          throw new GraphQLError("Invalid reset token payload", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [user] = await getUsers({ id: decoded.id, limit: 1 });
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        const salt = await bcrypt.genSalt();
        const hashedPwd = await bcrypt.hash(newPassword, salt);

        await saveData({
          table: "users",
          data: {
            password: hashedPwd,
            updated_at: new Date(),
          },
          id: decoded.id,
          connection,
        });

        await connection.commit();

        return {
          success: true,
          message: "Password reset successfully",
        };
      } catch (error) {
        if (connection) {
          await connection.rollback();
        }

        if (error instanceof GraphQLError) {
          throw error;
        }

        console.error("Password reset with token error:", error);
        throw new GraphQLError("Failed to reset password", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      } finally {
        if (connection) {
          connection.release();
        }
      }
    },
    requestPasswordResetLink: async (parent, args, context) => {
      const { email } = args;
      try {
        const [user] = await getUsers({ email, limit: 1 });

        // Return a generic success response to avoid account enumeration.
        if (!user) {
          return {
            success: false,
            message:
              "This user doesnt exist.",
          };
        }

        const resetToken = jwt.sign(
          { id: user.id, purpose: "password_reset" },
          PRIVATE_KEY,
          { expiresIn: "15m" }
        );

        const clientBaseUrl =
          process.env.CLIENT_URL || context?.req?.headers?.origin;

        if (!clientBaseUrl) {
          throw new GraphQLError("CLIENT_URL is not configured");
        }

        const resetUrl = new URL(
          "auth/reset-password/change",
          clientBaseUrl.endsWith("/") ? clientBaseUrl : `${clientBaseUrl}/`
        );
        resetUrl.searchParams.set("token", resetToken);

        const params = {
          to: email,
          subject: "Password Reset Request",
          message: `Hello ${user.name},\n\nYou requested a password reset. Please use the following link to reset your password:\n\n${resetUrl.toString()}\n\nThis link expires in 15 minutes. If you did not request this, please ignore this email.\n\nBest regards,\nPWD Observatory Team`,
        };
        await sendEmail(params);

        return {
          success: true,
          message:
            "If that email exists, a password reset link has been sent.",
        };
      } catch (error) {
        console.error("Password reset link error:", error);
        throw new GraphQLError("Failed to send password reset link");
      }
    },

    deleteUser: async (parent, args, context) => {
      const { user_id } = args;
      try {
        const userPermissions = context?.req?.user?.permissions;
        ensureAnyPermission(
          userPermissions,
          ["can_manage_users", "can_create_users"],
          "You dont have permissions to delete users"
        );

        // Input validation
        if (!user_id) {
          throw new GraphQLError("User ID is required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Check if user exists and isn't already deleted
        const [user] = await getUsers({ id: user_id, limit: 1 });

        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        if (user.deleted) {
          throw new GraphQLError("User is already deleted", {
            extensions: { code: "CONFLICT" },
          });
        }

        // Perform soft delete
        await saveData({
          table: "users",
          data: {
            deleted: true,
            updated_at: new Date(),
          },
          id: user_id,
        });

        return {
          success: true,
          message: "User account deactivated successfully",
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        console.error("User deletion error:", error);
        throw new GraphQLError("Failed to deactivate user account");
      }
    },
    

    deleteAccount: async (_parent, args, context) => {
      const userId = context?.req?.user?.id;
      if (!userId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const { password } = args;
      if (!password) {
        throw new GraphQLError("Password is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Fetch user password hash
      const [rows] = await db.execute(
        "SELECT password FROM users WHERE id = ? AND deleted = 0 LIMIT 1",
        [userId]
      );

      if (rows.length === 0) {
        throw new GraphQLError("User account not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      const user = rows[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        throw new GraphQLError("Incorrect password. Please verify your credentials and try again.", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Soft delete user
      await saveData({
        table: "users",
        data: {
          deleted: true,
          updated_at: new Date(),
        },
        id: userId,
      });

      return {
        success: true,
        message: "Your account has been deleted successfully",
      };
    },
  },
};

export default userResolvers;
