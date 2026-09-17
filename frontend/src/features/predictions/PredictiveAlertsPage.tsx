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
  status?: string;
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
      const res = await apiRequest<any>(
        "/analytics/predictive-alerts",
        {},
        token
      );
      const list = Array.isArray(res) ? res : (res?.alerts || []);
      setAlerts(list);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [token]);

  const highRisk = alerts.filter((a) => a.risk_level === "RIESGO_ALTO" || a.status === "RIESGO_ALTO");
  const medRisk = alerts.filter((a) => a.risk_level === "RIESGO_MEDIO" || a.status === "RIESGO_MEDIO");
  const noRisk = alerts.filter((a) => a.risk_level === "SIN_RIESGO" || a.status === "SIN_RIESGO");
  const insufficientData = alerts.filter((a) => a.risk_level === "DATOS_INSUFICIENTES" || a.status === "DATOS_INSUFICIENTES");

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
          {alerts.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>
              <BellRing size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>
                Sin alertas predictivas activas
              </h3>
              <p style={{ fontSize: 13, maxWidth: 520, margin: "0 auto", lineHeight: 1.5 }}>
                Aún no se han registrado suficientes órdenes históricas para calcular proyecciones de demanda de insumos. A medida que se completen servicios en mesas, se proyectarán los riesgos de inventario determinísticamente.
              </p>
            </div>
          ) : (
            alerts.map((item, idx) => {
              const status = item.risk_level || item.status;
              const isHigh = status === "RIESGO_ALTO";
              const isMed = status === "RIESGO_MEDIO";
              const isInsufficient = status === "DATOS_INSUFICIENTES";

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
                          backgroundColor: isHigh ? "var(--color-secondary-soft)" : isMed ? "var(--color-warning-soft)" : "var(--color-primary-soft)",
                          color: isHigh ? "var(--color-secondary)" : isMed ? "var(--color-warning)" : "var(--color-primary)",
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
                          Día analizado: {item.day_of_week || "Hoy"} • Turno operativo
                        </span>
                      </div>
                    </div>

                    <span className={`badge ${isHigh ? "badge-danger" : isMed ? "badge-warning" : isInsufficient ? "badge-neutral" : "badge-success"}`}>
                      <span className="badge-dot" />
                      {isHigh ? "Riesgo alto" : isMed ? "Riesgo medio" : isInsufficient ? "Datos insuficientes" : "Sin riesgo"}
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
          }))}
        </div>
      </div>
    </div>
  );
}
