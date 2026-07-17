import { ReactElement } from 'react';
import { Navigate } from 'react-router';
import { useAuthContext } from './useAuthContext';
import { getPermissionsFromToken } from '@/utils/permissions';

interface PermissionGuardProps {
  required?: string[];
  requiredAny?: string[];
  children: ReactElement;
}

const PermissionGuard = ({ required = [], requiredAny = [], children }: PermissionGuardProps) => {
  const { auth } = useAuthContext();
  const permissions = getPermissionsFromToken(auth?.access_token);

  const hasRequired = required.every((key) => Boolean(permissions[key]));
  const hasAny = requiredAny.length === 0 || requiredAny.some((key) => Boolean(permissions[key]));

  if (!hasRequired || !hasAny) {
    return <Navigate to="/error/404" replace />;
  }

  return children;
};

export { PermissionGuard };
