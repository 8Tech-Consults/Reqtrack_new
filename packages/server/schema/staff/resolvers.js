import { GraphQLError } from "graphql";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/config.js";
import saveData from "../../utils/db/saveData.js";
import checkPermission from "../../helpers/checkPermission.js";
import saveUpload from "../../helpers/saveUpload.js";
import { getRoles } from "../role/resolvers.js";

const DEFAULT_STAFF_PASSWORD = "NAD@2026";

export const fetchStaff = async ({
    id,
    limit = 10,
    offset = 0,
    search,}) => {
    
        try {
    let where = "WHERE users.deleted = 0";
    let values = [];

    if (id) {
      where += " AND users.id = ?";
      values.push(id);
    }

    if (search) {
      where +=
        " AND (users.username LIKE ? OR users.name LIKE ? OR users.email LIKE ?)";
      const q = `%${search}%`;
      values.push(q, q, q);
    }

        let sql = `
        SELECT 
        staff.*,
        roles.name as role_name,
        users.name as name
      FROM staff
      LEFT JOIN users ON users.id = staff.user_id
      LEFT JOIN roles ON roles.id = users.role_id
      ${where} ORDER BY staff.updated_at DESC LIMIT ? OFFSET ?
    `;

    values.push(limit, offset);

    const [results] = await db.execute(sql, values);

    return results;
  } catch (error) {
    throw new GraphQLError(error.message);
  }
  }

const staffResolvers = {
    Query: {
        getStaffs: async (parent, args, context, info) => {
            const userPermissions = context?.req?.user?.permissions;
            checkPermission(
                userPermissions, 
                "can_manage_staff", 
                "You do not have permission to view staff.");

            return fetchStaff(args);
        },
        getStaffById: async (parent, { id }, context, info) => {
            // Implement your logic to fetch a staff member by ID
        }
    },

    Mutation: {
        saveStaff: async (parent, { input }, context, info) => {
            const userPermissions = context?.req?.user?.permissions;
            checkPermission(
                userPermissions,
                "can_create_staff",
                "You do not have permission to add staff.");

            const {
                id,
                user_id,
                name,
                role_name,
                staff_number,
                nin_number,
                date_of_birth,
                title,
                contract_start,
                contract_end,
                telephone,
                email,
                bank,
                bank_account,
                tin,
                nssf,
                marital_status,
                next_of_kin,
                profile_picture,
                signature
            } = input;

            const connection = await db.getConnection();

            try {
                await connection.beginTransaction();
                const normalizedEmail = String(email || "").trim().toLowerCase();

                const [role] = await getRoles({ role_name });
                if (!role) {
                    throw new GraphQLError(`Role "${role_name}" was not found.`);
                }

                let userId = user_id;

                if (!userId) {
                    // New staff member: create their user account first with the default password.
                    const salt = await bcrypt.genSalt();
                    const hashedPwd = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, salt);

                    userId = await saveData({
                        connection,
                        table: "users",
                        data: {
                            id: uuidv4(),
                            username: normalizedEmail,
                            name,
                            email: normalizedEmail,
                            password: hashedPwd,
                            role_id: role.id,
                            created_at: new Date(),
                            updated_at: new Date(),
                        },
                    });
                } else {
                    // Existing staff member: keep their credentials, just sync the profile fields.
                    await saveData({
                        connection,
                        table: "users",
                        data: {
                            name,
                            role_id: role.id,
                            updated_at: new Date(),
                        },
                        id: userId,
                    });
                }

                const staffData = {
                    user_id: userId,
                    staff_number,
                    nin_number,
                    date_of_birth,
                    title,
                    contract_start,
                    contract_end,
                    telephone,
                    email: normalizedEmail,
                    bank,
                    bank_account,
                    tin,
                    nssf,
                    marital_status,
                    next_of_kin,
                };

                // profile_picture/signature are GraphQL Upload values. Only touch these
                // columns when a new file was actually sent, so editing a staff member
                // without re-selecting a photo/signature doesn't wipe the existing one.
                if (profile_picture) {
                    const savedProfilePicture = await saveUpload({
                        file: profile_picture,
                        subdir: "staff",
                        maxSize: 5 * 1024 * 1024,
                    });
                    staffData.profile_picture = savedProfilePicture.filename;
                }

                if (signature) {
                    const savedSignature = await saveUpload({
                        file: signature,
                        subdir: "staff",
                        maxSize: 5 * 1024 * 1024,
                    });
                    staffData.signature = savedSignature.filename;
                }

                const staffId = await saveData({
                    connection,
                    table: "staff",
                    data: staffData,
                    id: id ? id : null,
                });

                const [[savedStaff]] = await connection.execute(
                    `SELECT staff.*, users.name AS name
                     FROM staff
                     LEFT JOIN users ON users.id = staff.user_id
                     WHERE staff.id = ?
                     LIMIT 1`,
                    [staffId]
                );

                await connection.commit();

                return {
                    ...savedStaff,
                    id: staffId,
                    role_name: role.name,
                };
            } catch (error) {
                await connection.rollback();
                if (error instanceof GraphQLError) {
                    throw error;
                }
                throw new GraphQLError(error.message);
            } finally {
                connection.release();
            }
        }

    }
}


export default staffResolvers;