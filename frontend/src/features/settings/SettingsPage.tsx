import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  Settings,
  Save,
  CheckCircle2,
  Code,
  Building,
  FileText,
  Percent,
} from "lucide-react";

type RestaurantSettings = {
  restaurant_name: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
  invoice_prefix: string;
  tax_percentage: number;
  suggested_tip_percentage: number;
  currency: string;
};

export function SettingsPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;

  const [settings, setSettings] = useState<RestaurantSettings>({
    restaurant_name: "POTOQUITOS RESTAURANTE",
    nit: "901.234.567-8",
    address: "Calle 45 # 12-34, Bucaramanga, Colombia",
    phone: "+57 310 987 6543",
    email: "administracion@potoquitos.com",
    invoice_prefix: "FAC",
    tax_percentage: 0,
    suggested_tip_percentage: 10,
    currency: "COP",
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await apiRequest<RestaurantSettings>("/settings/", {}, token);
        setSettings(res);
      } catch {
        // Defaults already set
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest(
        "/settings/",
        {
          method: "PUT",
          body: JSON.stringify(settings),
        },
        token
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 840 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Configuración del Restaurante
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Datos fiscales, parámetros de facturación, propina y créditos oficiales del sistema.
          </p>
        </div>
      </div>

      {saved && (
        <div className="alert-box alert-success" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={18} />
          <span>Configuración guardada correctamente en el sistema.</span>
        </div>
      )}

      {message && (
        <div className="alert-box alert-danger">
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* CARD 1: DATOS FISCALES & ESTABLECIMIENTO */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Datos del Establecimiento</h3>
            <Building size={18} color="var(--color-text-muted)" />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nombre Comercial del Restaurante</label>
              <input
                type="text"
                value={settings.restaurant_name}
                onChange={(e) => setSettings({ ...settings, restaurant_name: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">NIT / Identificación Fiscal</label>
              <input
                type="text"
                value={settings.nit}
                onChange={(e) => setSettings({ ...settings, nit: e.target.value })}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Dirección Física</label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono de Contacto</label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Correo Electrónico de Contacto</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="form-input"
              required
            />
          </div>
        </div>

        {/* CARD 2: PARÁMETROS FISCALES Y DE FACTURACIÓN */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Facturación y Cobro</h3>
            <FileText size={18} color="var(--color-text-muted)" />
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Prefijo de Factura</label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Impuesto / IVA (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.tax_percentage}
                onChange={(e) => setSettings({ ...settings, tax_percentage: Number(e.target.value) })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Propina Sugerida (%)</label>
              <input
                type="number"
                min="0"
                max="25"
                value={settings.suggested_tip_percentage}
                onChange={(e) => setSettings({ ...settings, suggested_tip_percentage: Number(e.target.value) })}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: CRÉDITOS OFICIALES DE DESARROLLO (Spec 020-settings) */}
        <div className="card" style={{ backgroundColor: "var(--color-surface-secondary)" }}>
          <div className="card-header">
            <h3 className="card-title">Créditos de Desarrollo y Autoría</h3>
            <Code size={18} color="var(--color-primary)" />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Sistema web de gestión gastronómica desarrollado para <strong>POTOQUITOS</strong>.
          </p>
          <div style={{ marginTop: 12, padding: 14, backgroundColor: "var(--color-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
              Equipo de Arquitectura e Ingeniería
            </span>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", marginTop: 4 }}>
              Carlos Reales • Orlando Agamez
            </div>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
              Versión 1.0.0 — Todos los derechos reservados.
            </span>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary">
            <Save size={18} />
            <span>Guardar Configuración</span>
          </button>
        </div>
      </form>
    </div>
  );
}
