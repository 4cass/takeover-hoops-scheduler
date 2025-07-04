
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  allowedRoles: ('admin' | 'coach')[];
  restrictedForCoaches?: boolean;
};

export function ProtectedRoute({ allowedRoles, restrictedForCoaches = false }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/index" replace />;
  }

  // If the route is restricted for coaches and the user is a coach, redirect to dashboard
  if (restrictedForCoaches && role === 'coach') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
