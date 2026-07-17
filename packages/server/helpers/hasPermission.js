/**
 * Permission Checker
 * @param {Array|Object} userPermissions - The user's permissions (array of objects or flat object).
 * @param {string} permissionKey - The key of the permission to check.
 * @returns {boolean} - Whether the user is eligible (true) or not (false).
 */
const hasPermission = (userPermissions, permissionKey) => {
  if (!userPermissions) return false;

  // Case 1: If userPermissions is an array of objects
  if (Array.isArray(userPermissions)) {
    return userPermissions.some(
      (perm) =>
        (typeof perm === "string" && perm === permissionKey) ||
        (perm && typeof perm === "object" && perm[permissionKey] === true)
    );
  }

  // Case 2: If userPermissions is a flat object
  if (typeof userPermissions === "object") {
    return Boolean(userPermissions[permissionKey]);
  }

  return false;
};

export default hasPermission;
