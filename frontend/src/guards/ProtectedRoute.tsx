import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <main className="app-shell" role="status">
        Restaurando sesión…
      </main>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <ChangePasswordPage />;
  return <Outlet />;
}
