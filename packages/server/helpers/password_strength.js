import { GraphQLError } from "graphql";

function checkPasswordStrength(
  password,
  errorMessage = "server error: Failed to validate password"
) {
  try {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push("Password must contain at least one letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("[checkPasswordStrength] error:", error);
    throw new GraphQLError(errorMessage);
  }
}

export default checkPasswordStrength;