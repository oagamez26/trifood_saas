import React, { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export function PasswordResetPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsSuccess(false);
    try {
      const res = await apiRequest<{ message: string }>("/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      setIsSuccess(true);
      setStep("confirm");
    } catch (error) {
      setMessage((error as Error).message);
      setIsSuccess(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setIsSuccess(false);
    try {
      const res = await apiRequest<{ message: string }>("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setMessage(res.message);
      setIsSuccess(true);
    } catch (error) {
      setMessage((error as Error).message);
      setIsSuccess(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-modal)",
          padding: "36px 32px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <KeyRound size={26} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)" }}>
            Recuperación de Contraseña
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 6 }}>
            {step === "request"
              ? "Ingresa tu correo institucional para recibir un token de un solo uso."
              : "Ingresa el token de verificación y define tu nueva contraseña."}
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`alert-box ${isSuccess ? "alert-success" : "alert-danger"}`}
            style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}
          >
            {isSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message}</span>
          </div>
        )}

        {/* Step 1: Request Token */}
        {step === "request" ? (
          <form onSubmit={handleRequest} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico Registrado</label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted)",
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@potoquitos.com"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", height: 42, justifyContent: "center" }}
            >
              {busy ? "Enviando..." : "Solicitar Token"}
            </button>

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 600 }}
              >
                ¿Ya tienes un token? Haz clic aquí para canjearlo
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Confirm Token & New Password */
          <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Token Recibido</label>
              <div style={{ position: "relative" }}>
                <KeyRound
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted)",
                  }}
                />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Pegar token de restablecimiento"
                  className="form-input"
                  style={{ paddingLeft: 38, fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nueva Contraseña (mínimo 8 caracteres)</label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted)",
                  }}
                />
                <input
                  type="password"
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", height: 42, justifyContent: "center" }}
            >
              {busy ? "Restableciendo..." : "Restablecer Contraseña"}
            </button>

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setStep("request")}
                style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
              >
                ← Volver a solicitar token
              </button>
            </div>
          </form>
        )}

        {/* Footer Back Link */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
            }}
          >
            <ArrowLeft size={15} />
            <span>Regresar al Inicio de Sesión</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
