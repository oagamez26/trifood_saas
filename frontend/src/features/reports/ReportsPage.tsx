import React, { useEffect, useState } from "react";
import { apiRequest, downloadAuthenticatedBlob } from "../../services/api";
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
  FileText,
  FileCode,
  FileSpreadsheet,
  Clock,
  Printer,
  CalendarRange,
} from "lucide-react";

type SalesReport = {
  period_type?: string;
  from_date?: string;
  to_date?: string;
  total_sales: number;
  total_consumption?: number;
  total_tips?: number;
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

type PresetType = "HOY" | "AYER" | "SEMANA" | "MES" | "CUSTOM";

export function ReportsPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;

  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingXml, setDownloadingXml] = useState(false);
  const [message, setMessage] = useState("");

  // Helper date formatting
  const pad = (n: number) => String(n).padStart(2, "0");
  const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function getPresetDates(preset: "HOY" | "AYER" | "SEMANA" | "MES") {
    const d = new Date();
    if (preset === "HOY") {
      const s = toIsoDate(d);
      return { from: s, to: s };
    } else if (preset === "AYER") {
      const y = new Date(d);
      y.setDate(y.getDate() - 1);
      const s = toIsoDate(y);
      return { from: s, to: s };
    } else if (preset === "SEMANA") {
      const curr = new Date(d);
      const day = curr.getDay(); // 0 is Sunday, 1 is Monday
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(diff));
      return { from: toIsoDate(monday), to: toIsoDate(d) };
    } else if (preset === "MES") {
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from: toIsoDate(firstDay), to: toIsoDate(lastDay) };
    }
    const s = toIsoDate(d);
    return { from: s, to: s };
  }

  // Active period state (Defaults to HOY)
  const initialDates = getPresetDates("HOY");
  const [preset, setPreset] = useState<PresetType>("HOY");
  const [activeFromDate, setActiveFromDate] = useState<string>(initialDates.from);
  const [activeToDate, setActiveToDate] = useState<string>(initialDates.to);

  // Inputs for Custom Range
  const [customFrom, setCustomFrom] = useState<string>(initialDates.from);
  const [customTo, setCustomTo] = useState<string>(initialDates.to);

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val));

  const formatDateDisplay = (isoStr: string) => {
    if (!isoStr) return "";
    const parts = isoStr.split("-");
    if (parts.length !== 3) return isoStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const activePeriodDisplay = `${formatDateDisplay(activeFromDate)} — ${formatDateDisplay(activeToDate)}`;

  // Handler for preset button clicks
  function handlePresetSelect(newPreset: PresetType) {
    setPreset(newPreset);
    if (newPreset !== "CUSTOM") {
      const { from, to } = getPresetDates(newPreset);
      setActiveFromDate(from);
      setActiveToDate(to);
      setCustomFrom(from);
      setCustomTo(to);
    }
  }

  // Handler for applying custom range
  function handleApplyCustomRange(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setMessage("Debe ingresar fecha inicial y final.");
      return;
    }
    if (customFrom > customTo) {
      setMessage("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setMessage("");
    setActiveFromDate(customFrom);
    setActiveToDate(customTo);
  }

  async function loadReport(from: string, to: string) {
    try {
      setLoading(true);
      setMessage("");
      const params = new URLSearchParams();
      params.set("period_type", "custom");
      params.set("from_date", from);
      params.set("to_date", to);
      const res = await apiRequest<SalesReport>(`/analytics/sales?${params.toString()}`, {}, token);
      setReport(res);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(activeFromDate, activeToDate);
  }, [token, activeFromDate, activeToDate]);

  async function handleExportPdf() {
    try {
      setDownloadingPdf(true);
      setMessage("");
      const qs = `period_type=custom&from_date=${activeFromDate}&to_date=${activeToDate}`;
      const filename = `POTOQUITOS_REPORTE_${activeFromDate}_${activeToDate}.pdf`;
      await downloadAuthenticatedBlob(`/analytics/reports/pdf?${qs}`, token, filename);
    } catch (err) {
      setMessage("Error al generar PDF oficial. Abriendo impresión directa.");
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleExportExcel() {
    try {
      setDownloadingExcel(true);
      setMessage("");
      const qs = `from_date=${activeFromDate}&to_date=${activeToDate}`;
      const filename = `potoquitos_contabilidad_${activeFromDate}_${activeToDate}.xlsx`;
      await downloadAuthenticatedBlob(`/analytics/accounting/excel?${qs}`, token, filename);
    } catch (err) {
      setMessage(`Error al exportar Excel contable: ${(err as Error).message}`);
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function handleExportXml() {
    try {
      setDownloadingXml(true);
      setMessage("");
      const qs = `from_date=${activeFromDate}&to_date=${activeToDate}`;
      const filename = `POTOQUITOS_REPORTE_${activeFromDate}_${activeToDate}.xml`;
      await downloadAuthenticatedBlob(`/analytics/reports/xml?${qs}`, token, filename);
    } catch (err) {
      setMessage(`Error al exportar XML estructurado: ${(err as Error).message}`);
    } finally {
      setDownloadingXml(false);
    }
  }

  return (
    <div className="printable-report" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER DE IMPRESIÓN OFICIAL (Visible en vista previa de impresión) */}
      <div className="print-only-header">
        <div style={{ textAlign: "center", borderBottom: "2px solid #0f172a", paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.04em", color: "#0f172a" }}>POTOQUITOS</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>RESTAURANTE & COMIDAS RÁPIDAS · NIT: 901.458.789-2</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Calle 45 # 28 - 14, Barranquilla · Régimen Simple</div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
            Informe Gerencial y Consolidado Financiero
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
            Período evaluado: <strong>{activeFromDate}</strong> al <strong>{activeToDate}</strong> · Generado: {new Date().toLocaleString("es-CO")}
          </div>
        </div>
      </div>

      {/* 1. HEADER PRINCIPAL */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Reportes y Dinámica Gerencial
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Consolidado financiero real con PostgreSQL: ventas, costos de recetas, gastos y margen operativo.
          </p>
        </div>

        {/* ACCIONES DE EXPORTACIÓN */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={downloadingPdf}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            id="btn-export-pdf"
            title="Exportar informe oficial en formato PDF"
          >
            <Download size={15} />
            <span>{downloadingPdf ? "Generando PDF..." : "Exportar PDF"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={downloadingExcel}
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            id="btn-export-excel"
            title="Exportar consolidado contable en formato Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>{downloadingExcel ? "Generando Excel..." : "Exportar Excel"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportXml}
            disabled={downloadingXml}
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            id="btn-export-xml"
            title="Exportar reporte estructurado en formato XML UTF-8"
          >
            <FileCode size={15} />
            <span>{downloadingXml ? "Generando XML..." : "Exportar XML"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            title="Imprimir vista actual"
          >
            <Printer size={15} />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="alert-box alert-danger">
          <span>{message}</span>
        </div>
      )}

      {/* 2. UNIFIED FILTER TOOLBAR */}
      <div
        className="card no-print"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          borderLeft: "4px solid var(--color-primary)",
        }}
      >
        {/* ROW 1: PRESET BUTTONS + ACTIVE PERIOD BANNER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-primary)", marginRight: 4 }}>
              <Filter size={16} /> Período:
            </span>
            <button
              type="button"
              onClick={() => handlePresetSelect("HOY")}
              className={`btn btn-sm ${preset === "HOY" ? "btn-primary" : "btn-secondary"}`}
              id="btn-filter-hoy"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("AYER")}
              className={`btn btn-sm ${preset === "AYER" ? "btn-primary" : "btn-secondary"}`}
              id="btn-filter-ayer"
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("SEMANA")}
              className={`btn btn-sm ${preset === "SEMANA" ? "btn-primary" : "btn-secondary"}`}
              id="btn-filter-semana"
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("MES")}
              className={`btn btn-sm ${preset === "MES" ? "btn-primary" : "btn-secondary"}`}
              id="btn-filter-mes"
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("CUSTOM")}
              className={`btn btn-sm ${preset === "CUSTOM" ? "btn-primary" : "btn-secondary"}`}
              id="btn-filter-custom"
            >
              Rango Personalizado
            </button>
          </div>

          {/* ACTIVE PERIOD BADGE */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              backgroundColor: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}
          >
            <CalendarRange size={16} style={{ color: "var(--color-primary)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
              Período activo: <strong style={{ color: "var(--color-primary)" }}>{activePeriodDisplay}</strong>
            </span>
          </div>
        </div>

        {/* ROW 2: CUSTOM RANGE CONTROLS (ONLY WHEN CUSTOM SELECTED) */}
        {preset === "CUSTOM" && (
          <form
            onSubmit={handleApplyCustomRange}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 10,
              borderTop: "1px dashed var(--color-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Desde:</span>
              <input
                type="date"
                required
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="form-input"
                style={{ height: 34, fontSize: 13, padding: "4px 8px" }}
                id="input-custom-from"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Hasta:</span>
              <input
                type="date"
                required
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="form-input"
                style={{ height: 34, fontSize: 13, padding: "4px 8px" }}
                id="input-custom-to"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm" id="btn-apply-filters">
              Aplicar filtros
            </button>
          </form>
        )}
      </div>

      {/* 3. 5-COLUMN FINANCIAL KPIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <span className="kpi-label">Ventas Brutas</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 4 }}>
            {formatCOP(report?.total_sales ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: "var(--color-tertiary)", fontWeight: 600 }}>
            {report?.total_tips ? `+ ${formatCOP(report.total_tips)} propinas` : "Consumo registrado"}
          </span>
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
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: (report?.estimated_net_profit || 0) >= 0 ? "var(--color-tertiary)" : "var(--color-secondary)",
              marginTop: 4,
            }}
          >
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

      {/* 4. EVOLUCIÓN DE VENTAS & FORMAS DE PAGO */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 20 }}>
        {/* LEFT: EVOLUCIÓN DE VENTAS (BAR CHART) */}
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Evolución de Ventas Semanal</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Ingresos diarios consolidados en el período activo
                </span>
              </div>
              <span className="badge badge-neutral">
                {activePeriodDisplay}
              </span>
            </div>

            {/* Bars Visualization */}
            <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 14, paddingTop: 20, paddingBottom: 10 }}>
              {(!report?.sales_by_day || report.sales_by_day.length === 0 || (report.total_sales === 0)) ? (
                <div style={{ width: "100%", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13, alignSelf: "center" }}>
                  Sin ventas registradas para el período seleccionado.
                </div>
              ) : (
                report.sales_by_day.map((d) => (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)" }}>
                      {d.amount > 0 ? `$${Math.round(d.amount / 1000)}k` : "$0"}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 36,
                        height: `${Math.max(4, d.percentage)}%`,
                        backgroundColor: d.amount > 0 ? "var(--color-primary)" : "var(--color-border)",
                        borderRadius: "6px 6px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                      {d.day}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: MÉTODOS DE PAGO & TOP PRODUCTOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Métodos de Pago */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Distribución por Medio de Pago</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(!report?.sales_by_method || report.sales_by_method.length === 0 || report.total_sales === 0) ? (
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
                  No hay ventas de platos registradas para este período.
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
