import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { apiRequest } from "../../services/api";
import { IconButton } from "../../components/IconButton";
import {
  DollarSign,
  ShoppingBag,
  Armchair,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Clock,
  ChevronRight,
  Plus,
  UtensilsCrossed,
  ChefHat,
  CreditCard,
  Package,
} from "lucide-react";

type DashboardData = {
  sales_today: number;
  orders_today: number;
  tables_occupied: number;
  tables_total: number;
  critical_stock_count: number;
  recent_orders: Array<{
    id: number;
    table_number: string;
    waiter_name: string;
    state: string;
    total: number;
    created_at: string;
  }>;
  critical_ingredients: Array<{
    id: number;
    name: string;
    unit: string;
    current_stock: number;
    min_stock: number;
  }>;
};

export function DashboardPage() {
  const { user, accessToken, hasRole } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await apiRequest<any>("/analytics/dashboard", {}, accessToken!);
        if (res && typeof res.sales_today !== "undefined") {
          setData(res);
          return;
        }
      } catch {
        // synthesize from real endpoints
      }

      try {
        const [tables, ingredients, orders] = await Promise.all([
          apiRequest<any>("/tables-orders/tables", {}, accessToken!).catch(() => []),
          apiRequest<any>("/inventory/ingredients", {}, accessToken!).catch(() => []),
          apiRequest<any>("/tables-orders/orders", {}, accessToken!).catch(() => []),
        ]);
        const tList = Array.isArray(tables) ? tables : [];
        const iList = Array.isArray(ingredients) ? ingredients : [];
        const oList = Array.isArray(orders) ? orders : [];

        const activeTList = tList.filter((t: any) => t.is_active !== false);
        const occupied = activeTList.filter((t: any) => t.state !== "DISPONIBLE").length;
        const critical = iList.filter(
          (i: any) => Number(i.current_stock) <= Number(i.min_stock)
        );
        const activeOrders = oList.filter((o: any) =>
          ["BORRADOR", "CONFIRMADO", "EN_COCINA", "EN_PREPARACION", "LISTO"].includes(o.state)
        );
        const totalSales = oList
          .filter((o: any) => o.state === "ENTREGADO")
          .reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

        setData({
          sales_today: totalSales,
          orders_today: oList.length,
          tables_occupied: occupied,
          tables_total: activeTList.length || 0,
          critical_stock_count: critical.length,
          recent_orders: activeOrders.slice(0, 5).map((o: any) => ({
            id: o.id,
            table_number: String(o.table_session?.table?.number || o.table_number || "Mesa"),
            waiter_name: o.waiter_name || "Servicio",
            state: o.state,
            total: Number(o.total_amount || 0),
            created_at: String(o.created_at || "").slice(11, 16),
          })),
          critical_ingredients: critical.slice(0, 5),
        });
      } catch {
        // Keep non-blocking
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, [accessToken]);

  const getStateBadge = (state: string) => {
    switch (state) {
      case "LISTO":
        return <span className="badge badge-success"><span className="badge-dot" />Listo</span>;
      case "EN_PREPARACION":
        return <span className="badge badge-info"><span className="badge-dot" />En preparación</span>;
      case "EN_COCINA":
        return <span className="badge badge-warning"><span className="badge-dot" />En cocina</span>;
      case "ENTREGADO":
        return <span className="badge badge-neutral"><span className="badge-dot" />Entregado</span>;
      default:
        return <span className="badge badge-neutral"><span className="badge-dot" />{state}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* GREETING & HERO */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Hola, <span style={{ color: "var(--color-primary)" }}>{user?.first_name || "Usuario"}</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Aquí tienes el resumen operativo y comercial de Restaurante POTOQUITOS.
          </p>
        </div>

        {/* Quick Action Button */}
        {(hasRole("ADMINISTRADOR") || hasRole("MESERO")) && (
          <button
            onClick={() => navigate("/tables")}
            className="btn btn-primary"
            style={{ boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)" }}
          >
            <Plus size={18} />
            <span>Toma de pedido / Mesas</span>
          </button>
        )}
      </div>

      {/* KPI METRIC CARDS (Stitch Layout) */}
      <div className="grid-4">
        {/* KPI 1: Ventas Hoy */}
        <div className="kpi-card">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-secondary)" }}>
              <DollarSign size={24} color="#ffffff" />
            </div>
            <div>
              <span className="kpi-label">Ventas de hoy</span>
              <div className="kpi-value">{formatCOP(data?.sales_today ?? 0)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--color-tertiary)" }}>
                <TrendingUp size={14} />
                <span>En vivo</span>
                <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>turno actual</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Pedidos Hoy */}
        <div className="kpi-card">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-primary)" }}>
              <ShoppingBag size={24} color="#ffffff" />
            </div>
            <div>
              <span className="kpi-label">Pedidos de hoy</span>
              <div className="kpi-value">{data?.orders_today ?? 0}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--color-tertiary)" }}>
                <TrendingUp size={14} />
                <span>{data?.orders_today ? `${data.orders_today} procesados` : "Sin órdenes"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Mesas Ocupadas */}
        <div className="kpi-card">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-info-soft)", color: "var(--color-primary)" }}>
              <Armchair size={24} color="var(--color-primary)" />
            </div>
            <div>
              <span className="kpi-label">Mesas en atención</span>
              <div className="kpi-value">
                {data?.tables_occupied ?? 0} <span style={{ fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>/ {data?.tables_total ?? 0}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span className="badge badge-info" style={{ height: 22, fontSize: 11 }}>
                  Salón al {data?.tables_total ? Math.round(((data?.tables_occupied || 0) / data.tables_total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
          <IconButton
            icon={ChevronRight}
            tooltip="Ver mapa de mesas"
            onClick={() => navigate("/tables")}
            variant="ghost"
            size="md"
          />
        </div>

        {/* KPI 4: Alertas de Stock */}
        <div className="kpi-card">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-secondary-soft)" }}>
              <AlertTriangle size={24} color="var(--color-secondary)" />
            </div>
            <div>
              <span className="kpi-label">Stock en riesgo</span>
              <div className="kpi-value" style={{ color: (data?.critical_stock_count || 0) > 0 ? "var(--color-secondary)" : "var(--color-tertiary)" }}>
                {data?.critical_stock_count ?? 0}
              </div>
              <div style={{ marginTop: 4 }}>
                <span className={`badge ${(data?.critical_stock_count || 0) > 0 ? "badge-danger" : "badge-success"}`} style={{ height: 22, fontSize: 11 }}>
                  {(data?.critical_stock_count || 0) > 0 ? "Insumos críticos" : "Stock seguro"}
                </span>
              </div>
            </div>
          </div>
          <IconButton
            icon={ChevronRight}
            tooltip="Ver inventario"
            onClick={() => navigate("/inventory")}
            variant="ghost"
            size="md"
          />
        </div>
      </div>

      {/* QUICK WORKSPACE ACCESS TILES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div
          onClick={() => navigate("/tables")}
          className="card"
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}
        >
          <div style={{ padding: 10, borderRadius: 10, backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
            <Armchair size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Mesas y Salón</h4>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Ver comensales y estados</span>
          </div>
        </div>

        <div
          onClick={() => navigate("/kitchen")}
          className="card"
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}
        >
          <div style={{ padding: 10, borderRadius: 10, backgroundColor: "var(--color-warning-soft)", color: "var(--color-warning)" }}>
            <ChefHat size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Cocina / KDS</h4>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Comandas en preparación</span>
          </div>
        </div>

        <div
          onClick={() => navigate("/cash")}
          className="card"
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}
        >
          <div style={{ padding: 10, borderRadius: 10, backgroundColor: "var(--color-tertiary-soft)", color: "var(--color-tertiary)" }}>
            <CreditCard size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Cobro de Mesa POS</h4>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Facturación y pago presencial</span>
          </div>
        </div>

        <div
          onClick={() => navigate("/inventory")}
          className="card"
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}
        >
          <div style={{ padding: 10, borderRadius: 10, backgroundColor: "var(--color-surface-secondary)", color: "var(--color-text-primary)" }}>
            <Package size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Inventario & Kardex</h4>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Stock de ingredientes</span>
          </div>
        </div>
      </div>

      {/* 2-COLUMN SECTION: RECENT ORDERS & INVENTORY RADAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}>
        {/* LEFT: RECENT ORDERS TABLE */}
        <div className="table-container">
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Comandas Activas en Salón</h3>
            <Link to="/tables" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 4 }}>
              Ver todas <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Mesero</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Hora</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.recent_orders || data.recent_orders.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-muted)" }}>
                      No hay comandas activas en este momento.
                    </td>
                  </tr>
                ) : (
                  data.recent_orders.map((ord) => (
                    <tr key={ord.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor: "var(--color-primary-soft)",
                              color: "var(--color-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {ord.table_number}
                          </div>
                          <span style={{ fontWeight: 600 }}>Mesa {ord.table_number}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--color-text-secondary)" }}>{ord.waiter_name}</td>
                      <td>{getStateBadge(ord.state)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCOP(ord.total)}</td>
                      <td style={{ textAlign: "right", color: "var(--color-text-muted)", fontSize: 12 }}>
                        {ord.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: INVENTORY WATCH PANEL */}
        <div className="card" style={{ display: "flex", flexDirection: "column", height: "fit-content" }}>
          <div>
            <div className="card-header">
              <h3 className="card-title">Insumos en Alerta</h3>
              <span className={`badge ${(data?.critical_stock_count || 0) > 0 ? "badge-danger" : "badge-success"}`}>
                {(data?.critical_stock_count || 0) > 0 ? "Críticos" : "Al día"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Insumos con existencia por debajo del margen de seguridad requerido para el turno.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(!data?.critical_ingredients || data.critical_ingredients.length === 0) ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  Todos los insumos se encuentran en niveles seguros de inventario.
                </div>
              ) : (
                data.critical_ingredients.map((item: any) => {
                  const currentSt = Number(item.stock ?? item.current_stock ?? 0);
                  const minSt = Number(item.min_stock ?? 0);
                  const isCritical = currentSt <= minSt * 0.5;
                  const unitLabel = item.base_unit || item.unit || "und";
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 12,
                        backgroundColor: "var(--color-surface-secondary)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div>
                        <h5 style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</h5>
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          Stock actual: <strong>{currentSt} {unitLabel}</strong> • Mín: {minSt} {unitLabel}
                        </span>
                      </div>
                      <span className={`badge ${isCritical ? "badge-danger" : "badge-warning"}`}>
                        {isCritical ? "Crítico" : "Bajo"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
            <button
              onClick={() => navigate("/inventory")}
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              <Package size={16} />
              <span>Ver Inventario y Registrar Entrada</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
