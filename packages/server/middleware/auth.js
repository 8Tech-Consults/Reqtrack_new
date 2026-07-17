import { GraphQLError } from "graphql";
import jwt from "jsonwebtoken";
import { db, PRIVATE_KEY } from "../config/config.js";
import tryParseJSON from "../helpers/tryParseJSON.js";
// import { getUserLastLoginDetails } from "../schema/user/resolvers.js";

const authenticateUser = async ({ req }) => {
  const authHeader = req.headers["authorization"];
  const portalType = req.headers["x-portal-type"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new GraphQLError("Please sign in to continue.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  let secretKey = PRIVATE_KEY;
  //   if (portalType === "student") {
  //     secretKey = PORTAL_PRIVATE_KEY;
  //   } else if (portalType == "applicant") {
  //     secretKey = APPLICANT_PRIVATE_KEY;
  //   } else {
  //     secretKey = PRIVATE_KEY;
  //   }

  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch (error) {
    throw new GraphQLError("Your session has expired. Please sign in again.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  if (!decoded) {
    throw new GraphQLError("Your session is invalid. Please sign in again.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  if (portalType == "student" || portalType == "applicant") {
    req.user = decoded;
    return;
  }

  // Continue with further checks if the token is verified
  //   const lastLogin = await getUserLastLoginDetails({
  //     user_id: decoded.id,
  //     lastRecord: true,
  //   });

  //   // console.log("last login", lastLogin);

  //   if (!lastLogin[0] || lastLogin[0].session_id !== decoded.session_id)
  //     throw new GraphQLError("Invalid token...", {
  //       extensions: { code: "UNAUTHENTICATED" },
  //     });

  try {
    const [rows] = await db.execute(
      `SELECT users.id, users.deleted, roles.permissions
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       WHERE users.id = ?
       LIMIT 1`,
      [decoded.id],
    );
    const currentUser = rows[0];

    if (!currentUser || Number(currentUser.deleted) === 1) {
      throw new GraphQLError("Your session is no longer active. Please sign in again.", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    // Refresh permissions on each request so revocations apply immediately
    // instead of waiting for the JWT to expire.
    req.user = {
      ...decoded,
      permissions: tryParseJSON(tryParseJSON(currentUser.permissions)) || [],
    };
  } catch (error) {
    if (error instanceof GraphQLError) throw error;
    throw new GraphQLError("We could not verify your session. Please try again.", {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
};
export default authenticateUser;
