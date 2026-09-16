import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Info,
  AlertCircle,
} from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Credenciales inválidas."
      );
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
      {/* 2-COLUMN MAIN CARD (Stitch login_potoquitos) */}
      <main
        style={{
          width: "100%",
          maxWidth: 900,
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 4px 20px rgba(15, 39, 71, 0.08)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
        }}
      >
        {/* COLUMNA IZQUIERDA: IDENTIDAD Y MARCA */}
        <div
          style={{
            backgroundColor: "var(--color-surface-secondary)",
            padding: "44px 36px",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* Top tag */}
          <span
            style={{
              padding: "4px 14px",
              borderRadius: "var(--radius-pill)",
              backgroundColor: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Sistema de Gestión
          </span>

          {/* Logo y Nombre */}
          <div style={{ margin: "24px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 140, height: 140, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src="/logo.png"
                alt="Logo Oficial POTOQUITOS"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
              POTOQUITOS RESTAURANTE
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 8, maxWidth: 280, lineHeight: 1.5 }}>
              Plataforma administrativa y operativa centralizada para restaurantes.
            </p>
          </div>

          {/* Footer Informativo */}
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--color-tertiary)" }}>
              <ShieldCheck size={16} />
              <span>Acceso seguro cifrado</span>
            </div>
            <span>v1.0.0 • Desarrollado por Carlos Reales | Orlando Agamez</span>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO DE AUTENTICACIÓN */}
        <div style={{ padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
              Iniciar sesión
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
              Ingresa tus credenciales autorizadas para acceder a tu área de trabajo.
            </p>
          </div>

          {error && (
            <div className="alert-box alert-danger" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Campo: Usuario */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Usuario</label>
              <div style={{ position: "relative" }}>
                <User size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  type="text"
                  placeholder="Ej. admin, mesero01, caja01"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="form-input"
                  style={{ paddingLeft: 42, height: 44 }}
                />
              </div>
            </div>

            {/* Campo: Contraseña */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Contraseña</label>
                <Link to="/password-reset" style={{ fontSize: 12, color: "var(--color-primary)", fontWeight: 600 }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="form-input"
                  style={{ paddingLeft: 42, paddingRight: 42, height: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted)",
                    padding: 4,
                  }}
                  aria-label="Mostrar contraseña"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Botón Ingresar */}
            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ height: 46, fontSize: 15, width: "100%", marginTop: 8 }}
            >
              <span>{busy ? "Validando credenciales..." : "Ingresar al sistema"}</span>
              <ArrowRight size={18} />
            </button>

            {/* Mensaje informativo de roles */}
            <div
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface-secondary)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ lineHeight: 1.4, margin: 0 }}>
                Perfiles de acceso autorizados: <strong style={{ color: "var(--color-text-primary)" }}>Administrador</strong>, <strong style={{ color: "var(--color-text-primary)" }}>Mesero</strong>, <strong style={{ color: "var(--color-text-primary)" }}>Cocina</strong> y <strong style={{ color: "var(--color-text-primary)" }}>Cajero</strong>.
              </p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
