import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiRequest } from "../../services/api";
export function ChangePasswordPage() {
  const { accessToken, logout } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest(
        "/auth/change-password",
        { method: "POST", body: JSON.stringify(Object.fromEntries(data)) },
        accessToken!,
      );
      await logout().catch(() => {});
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app-shell">
      <h1>Cambiar contraseña</h1>
      <form className="stack-form" onSubmit={submit}>
        <label>
          Contraseña actual
          <input
            type="password"
            name="current_password"
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          Nueva contraseña
          <input
            type="password"
            name="new_password"
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
        <p>
          Usa al menos ocho caracteres, letras y números. Se cerrarán las
          sesiones anteriores.
        </p>
        <button disabled={busy}>Guardar contraseña</button>
        {message && <p role="alert">{message}</p>}
      </form>
    </main>
  );
}
