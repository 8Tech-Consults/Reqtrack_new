import { GraphQLError } from "graphql";
import hasPermission from "./hasPermission.js";

const requireAnyPermission = (
  context,
  permissionKeys,
  message = "You do not have permission to perform this action.",
) => {
  const user = context?.req?.user;
  if (!user) {
    throw new GraphQLError("Please sign in to continue.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
  if (!keys.some((key) => hasPermission(user.permissions, key))) {
    throw new GraphQLError(message, {
      extensions: { code: "FORBIDDEN" },
    });
  }
};

export default requireAnyPermission;
