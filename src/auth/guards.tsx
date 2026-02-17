import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from './auth';
import { hasRoleAccess, type Role } from './permissions';

type RouteGuardProps = {
  requiredRole?: Role;
  element?: JSX.Element;
};

export function RouteGuard({ requiredRole, element }: RouteGuardProps) {
  const session = getSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && !hasRoleAccess(session.role, requiredRole)) {
    return <Navigate to="/denied" replace />;
  }

  if (element) {
    return element;
  }

  return <Outlet />;
}
