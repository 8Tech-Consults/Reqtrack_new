type FlatPermissions = Record<string, boolean>;

const base64UrlDecode = (str: string): string => {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return json;
  } catch {
    return '';
  }
};

const decodeJWTPayload = (token?: string) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  const payloadJson = base64UrlDecode(parts[1]);
  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
};

const flattenPermissions = (permissions: unknown): FlatPermissions => {
  const flat: FlatPermissions = {};

  if (Array.isArray(permissions)) {
    for (const item of permissions) {
      if (typeof item === 'string' && item.trim() !== '') {
        flat[item] = true;
        continue;
      }

      if (item && typeof item === 'object') {
        for (const [key, value] of Object.entries(item)) {
          if (Boolean(value)) {
            flat[key] = true;
          }
        }
      }
    }
  }

  if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
    for (const [key, value] of Object.entries(permissions)) {
      if (Boolean(value)) {
        flat[key] = true;
      }
    }
  }

  return flat;
};

const getPermissionsFromToken = (token?: string): FlatPermissions => {
  const payload = decodeJWTPayload(token) as { permissions?: unknown } | null;
  if (!payload) return {};
  return flattenPermissions(payload.permissions);
};

export { decodeJWTPayload, flattenPermissions, getPermissionsFromToken };
