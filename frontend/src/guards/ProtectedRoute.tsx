import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type AuthUser } from "../contexts/AuthContext";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";

export function getDefaultHomeForUser(user: AuthUser | null): string {
  if (!user) return "/login";
  if (user.roles.includes("ADMINISTRADOR")) return "/";
  if (user.roles.includes("MESERO")) return "/tables";
  if (user.roles.includes("COCINA")) return "/kitchen";
  if (user.roles.includes("CAJERO")) return "/cash";
  return "/";
}

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] } = {}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="app-shell" role="status">
        Restaurando sesión…
      </main>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <ChangePasswordPage />;

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = user.roles.some((r) => allowedRoles.includes(r));
    if (!hasAllowedRole) {
      return <Navigate to={getDefaultHomeForUser(user)} replace />;
    }
  }

  return <Outlet />;
}
