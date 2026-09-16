import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  Calendar,
  Download,
  Filter,
} from "lucide-react";

type SalesReport = {
  total_sales: number;
  orders_count: number;
  average_ticket: number;
  estimated_cost: number;
  estimated_expenses: number;
  estimated_net_profit: number;
  margin_percentage: number;
  sales_by_day: Array<{ day: string; amount: number; percentage: number }>;
  sales_by_method: Array<{ method: string; amount: number; count: number }>;
  top_products: Array<{ name: string; quantity: number; total: number }>;
};

export function ReportsPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val));

  async function loadReport() {
    try {
      setLoading(true);
      const res = await apiRequest<SalesReport>("/analytics/sales", {}, token);
      setReport(res);
    } catch {
      setReport({
        total_sales: 0,
        orders_count: 0,
        average_ticket: 0,
        estimated_cost: 0,
        estimated_expenses: 0,
        estimated_net_profit: 0,
        margin_percentage: 0,
        sales_by_day: [
          { day: "Lun", amount: 0, percentage: 0 },
          { day: "Mar", amount: 0, percentage: 0 },
          { day: "Mié", amount: 0, percentage: 0 },
          { day: "Jue", amount: 0, percentage: 0 },
          { day: "Vie", amount: 0, percentage: 0 },
          { day: "Sáb", amount: 0, percentage: 0 },
          { day: "Dom", amount: 0, percentage: 0 },
        ],
        sales_by_method: [],
        top_products: [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, [token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Reportes y Dinámica Gerencial
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Consolidado financiero, evolución de ventas, costos de recetas y margen operativo.
          </p>
        </div>

        <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
          <Download size={15} />
          <span>Exportar Informe</span>
        </button>
      </div>

      {/* 5-COLUMN FINANCIAL KPIS (Stitch reportes_y_din_mica_gerencial) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Ventas Brutas</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 4 }}>
            {formatCOP(report?.total_sales ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-tertiary)", fontWeight: 600 }}>En vivo</span>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Costo Insumos (Recetas)</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 4 }}>
            {formatCOP(report?.estimated_cost ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Consumo según Kardex</span>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Gastos Operativos</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 4 }}>
            {formatCOP(report?.estimated_expenses ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>Fijos y variables</span>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Resultado Neto Estimado</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: (report?.estimated_net_profit || 0) >= 0 ? "var(--color-tertiary)" : "var(--color-secondary)", marginTop: 4 }}>
            {formatCOP(report?.estimated_net_profit ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 700 }}>
            Margen ~{report?.margin_percentage ?? 0}%
          </span>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Total Pedidos</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 4 }}>
            {report?.orders_count ?? 0}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            Ticket: {formatCOP(report?.average_ticket ?? 0)}
          </span>
        </div>
      </div>

      {/* 2 COLUMNS: EVOLUCIÓN DE VENTAS (BAR CHART) & FORMAS DE PAGO */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 20 }}>
        {/* LEFT: WEEKLY SALES BAR CHART */}
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Evolución de Ventas Semanal</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Ingresos diarios consolidados</span>
              </div>
              <span className="badge badge-neutral">Esta semana</span>
            </div>

            {/* Bars Visualization */}
            <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 14, paddingTop: 20, paddingBottom: 10 }}>
              {report?.sales_by_day.map((d) => (
                <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)" }}>
                    ${Math.round(d.amount / 1000)}k
                  </span>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 36,
                      height: `${d.percentage}%`,
                      backgroundColor: "var(--color-primary)",
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.3s ease",
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: MÉTODOS DE PAGO & TOP PRODUCTOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Métodos de Pago */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Distribución por Forma de Pago</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(!report?.sales_by_method || report.sales_by_method.length === 0) ? (
                <div style={{ padding: "14px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No hay pagos registrados para este período.
                </div>
              ) : (
                report.sales_by_method.map((m, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "var(--color-surface-secondary)", borderRadius: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.method}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>{m.count} transacciones</span>
                    </div>
                    <strong style={{ fontSize: 14 }}>{formatCOP(m.amount)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Platos */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Platos Más Vendidos</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(!report?.top_products || report.top_products.length === 0) ? (
                <div style={{ padding: "14px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No hay ventas de platos registradas aún.
                </div>
              ) : (
                report.top_products.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <span>{idx + 1}. <strong>{p.name}</strong> ({p.quantity} unds)</span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(p.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
