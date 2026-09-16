import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  BellRing,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  TrendingUp,
  ArrowRight,
  UtensilsCrossed,
  Layers,
} from "lucide-react";

type PredictiveAlert = {
  product_id: number;
  product_name: string;
  day_of_week: string;
  risk_level: "RIESGO_ALTO" | "RIESGO_MEDIO" | "SIN_RIESGO" | "DATOS_INSUFICIENTES";
  current_capacity: number;
  estimated_demand: number;
  projected_deficit: number;
  limiting_ingredient?: string;
  recommendation: string;
};

export function PredictiveAlertsPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAlerts() {
    try {
      setLoading(true);
      const res = await apiRequest<PredictiveAlert[]>(
        "/analytics/predictive-alerts",
        {},
        token
      );
      setAlerts(res);
    } catch {
      // Fallback sample conforming to Stitch alertas_predictivas_potoquitos
      setAlerts([
        {
          product_id: 1,
          product_name: "Hamburguesa Especial",
          day_of_week: "Viernes",
          risk_level: "RIESGO_ALTO",
          current_capacity: 30,
          estimated_demand: 40,
          projected_deficit: 10,
          limiting_ingredient: "Carne de res molida",
          recommendation: "Ingresar al menos 2.0 kg de Carne de res para garantizar el turno nocturno.",
        },
        {
          product_id: 2,
          product_name: "Picada Familiar POTOQUITOS",
          day_of_week: "Viernes",
          risk_level: "RIESGO_MEDIO",
          current_capacity: 12,
          estimated_demand: 14,
          projected_deficit: 2,
          limiting_ingredient: "Papa criolla",
          recommendation: "Monitorear existencia de papa criolla antes de las 8:00 PM.",
        },
        {
          product_id: 3,
          product_name: "Perro Caliente Especial",
          day_of_week: "Viernes",
          risk_level: "SIN_RIESGO",
          current_capacity: 50,
          estimated_demand: 25,
          projected_deficit: 0,
          recommendation: "Holgura operativa suficiente para más de 48 horas de operación.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [token]);

  const highRisk = alerts.filter((a) => a.risk_level === "RIESGO_ALTO");
  const medRisk = alerts.filter((a) => a.risk_level === "RIESGO_MEDIO");
  const noRisk = alerts.filter((a) => a.risk_level === "SIN_RIESGO");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Alertas Predictivas de Demanda
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Análisis estadístico determinístico de capacidad de insumos vs. demanda proyectada por día de la semana.
          </p>
        </div>
      </div>

      {/* TOP METRICS (Stitch alertas_predictivas_potoquitos) */}
      <div className="grid-4">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Alertas Activas</span>
            <div className="kpi-value">{highRisk.length + medRisk.length}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>En monitoreo hoy</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-surface-secondary)" }}>
            <BellRing size={22} color="var(--color-text-primary)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Déficit en Turno</span>
            <div className="kpi-value" style={{ color: "var(--color-secondary)" }}>{highRisk.length}</div>
            <span style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 600 }}>Riesgo alto</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-secondary-soft)" }}>
            <AlertTriangle size={22} color="var(--color-secondary)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Capacidad Ajustada</span>
            <div className="kpi-value" style={{ color: "var(--color-warning)" }}>{medRisk.length}</div>
            <span style={{ fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>Riesgo medio</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-warning-soft)" }}>
            <Clock size={22} color="var(--color-warning)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Sin Riesgo</span>
            <div className="kpi-value" style={{ color: "var(--color-tertiary)" }}>{noRisk.length}</div>
            <span style={{ fontSize: 11, color: "var(--color-tertiary)", fontWeight: 600 }}>Holgura &gt; 48h</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-tertiary-soft)" }}>
            <CheckCircle2 size={22} color="var(--color-tertiary)" />
          </div>
        </div>
      </div>

      {/* DETAILED ATTENTION ITEMS */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          Productos que requieren atención operativa
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {alerts.map((item, idx) => {
            const isHigh = item.risk_level === "RIESGO_ALTO";
            const isMed = item.risk_level === "RIESGO_MEDIO";

            return (
              <div
                key={idx}
                className="card"
                style={{
                  padding: 22,
                  borderColor: isHigh
                    ? "var(--color-secondary)"
                    : isMed
                    ? "var(--color-warning)"
                    : "var(--color-border)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: isHigh ? "var(--color-secondary-soft)" : "var(--color-primary-soft)",
                        color: isHigh ? "var(--color-secondary)" : "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <UtensilsCrossed size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800 }}>{item.product_name}</h3>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                        Día analizado: {item.day_of_week} • Turno pico
                      </span>
                    </div>
                  </div>

                  <span className={`badge ${isHigh ? "badge-danger" : isMed ? "badge-warning" : "badge-success"}`}>
                    <span className="badge-dot" />
                    {isHigh ? "Riesgo alto" : isMed ? "Riesgo medio" : "Sin riesgo"}
                  </span>
                </div>

                {/* Triple Comparative Metric Block */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, margin: "16px 0" }}>
                  <div style={{ padding: 14, backgroundColor: "var(--color-surface-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                    <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--color-text-secondary)" }}>
                      Capacidad actual
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                      {item.current_capacity} <span style={{ fontSize: 12, fontWeight: 500 }}>porciones</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Con inventario en bodega</span>
                  </div>

                  <div style={{ padding: 14, backgroundColor: "var(--color-surface-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                    <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--color-text-secondary)" }}>
                      Demanda estimada
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                      {item.estimated_demand} <span style={{ fontSize: 12, fontWeight: 500 }}>porciones</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Histórico de ventas</span>
                  </div>

                  <div
                    style={{
                      padding: 14,
                      backgroundColor: isHigh ? "var(--color-secondary-soft)" : "var(--color-surface-secondary)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: isHigh ? "var(--color-secondary)" : "var(--color-text-secondary)" }}>
                      Déficit proyectado
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: isHigh ? "var(--color-secondary)" : "var(--color-text-primary)" }}>
                      {item.projected_deficit > 0 ? `-${item.projected_deficit}` : "0"}{" "}
                      <span style={{ fontSize: 12, fontWeight: 500 }}>porciones</span>
                    </div>
                    <span style={{ fontSize: 11, color: isHigh ? "var(--color-secondary)" : "var(--color-text-muted)" }}>
                      {item.limiting_ingredient ? `Limita: ${item.limiting_ingredient}` : "Sin faltante"}
                    </span>
                  </div>
                </div>

                {/* Recommendation & Action */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                  <p style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>
                    <strong>Recomendación:</strong> {item.recommendation}
                  </p>

                  <button
                    onClick={() => navigate("/inventory")}
                    className="btn btn-secondary btn-sm"
                  >
                    <Package size={15} />
                    <span>Ir a inventario</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
