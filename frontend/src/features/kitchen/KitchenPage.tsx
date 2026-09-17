import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Check,
  RotateCw,
  User,
  UtensilsCrossed,
} from "lucide-react";

type OrderLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  notes?: string | null;
};

type Order = {
  id: number;
  table_session_id: number;
  table_number?: string;
  waiter_name?: string;
  state: "EN_COCINA" | "EN_PREPARACION" | "LISTO" | "ENTREGADO" | string;
  created_at: string;
  lines: OrderLine[];
};

export function KitchenPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function loadKitchenOrders() {
    try {
      const [oList, tList] = await Promise.all([
        apiRequest<Order[]>("/kitchen/orders", {}, token).catch(() =>
          apiRequest<Order[]>("/tables-orders/orders", {}, token)
        ),
        apiRequest<any[]>("/tables-orders/tables", {}, token).catch(() => []),
      ]);
      setTables(tList);
      setOrders(oList);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKitchenOrders();
    const interval = setInterval(loadKitchenOrders, 4000);
    return () => clearInterval(interval);
  }, [token]);

  async function handleAdvance(orderId: number, nextState: "prepare" | "ready") {
    try {
      setBusyId(orderId);
      await apiRequest(`/kitchen/orders/${orderId}/${nextState}`, { method: "POST" }, token);
      await loadKitchenOrders();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const getTableNumber = (tableSessionId: number) => {
    const found = tables.find((t) => t.active_session?.id === tableSessionId);
    return found ? found.number : "Salón";
  };

  const getMinutesAgo = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
      if (diff < 1) return "Justo ahora";
      return `Hace ${diff} min`;
    } catch {
      return "Reciente";
    }
  };

  const pendientes = orders.filter((o) => o.state === "EN_COCINA");
  const enPrep = orders.filter((o) => o.state === "EN_PREPARACION");
  const listos = orders.filter((o) => o.state === "LISTO");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KDS HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ padding: 10, borderRadius: 12, backgroundColor: "var(--color-warning-soft)", color: "var(--color-warning)" }}>
            <ChefHat size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Monitor de Cocina (KDS)
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 1 }}>
              Control en tiempo real de fogón, plancha y entrega a meseros.
            </p>
          </div>
        </div>

        <button
          onClick={loadKitchenOrders}
          className="btn btn-secondary btn-sm"
          title="Actualizar ahora"
        >
          <RotateCw size={15} />
          <span>Actualizar</span>
        </button>
      </div>

      {message && (
        <div className="alert-box alert-danger">
          <span>{message}</span>
        </div>
      )}

      {/* 3-COLUMN KANBAN (Stitch cocina_potoquitos) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "flex-start" }}>
        {/* COLUMNA 1: PENDIENTES */}
        <div
          style={{
            backgroundColor: "var(--color-surface-secondary)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--color-secondary)" }} />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pendientes</h3>
              <span className="badge badge-danger" style={{ height: 22, fontSize: 11, padding: "0 8px" }}>
                {pendientes.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Por entrar a fogón</span>
          </div>

          {pendientes.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              No hay pedidos pendientes
            </div>
          ) : (
            pendientes.map((order) => (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text-primary)" }}>
                      #{order.id}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", marginLeft: 8 }}>
                      Mesa {getTableNumber(order.table_session_id)}
                    </span>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: 11 }}>
                    <Clock size={12} />
                    {getMinutesAgo(order.created_at)}
                  </span>
                </div>

                {/* Items */}
                <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 10, borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {order.lines.map((line, idx) => (
                    <div key={idx}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                        <span>{line.quantity} × {line.product_name}</span>
                      </div>
                      {line.notes && (
                        <div style={{ marginTop: 2, padding: "3px 8px", backgroundColor: "var(--color-warning-soft)", borderRadius: 4, fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>
                          ● {line.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action */}
                <button
                  onClick={() => handleAdvance(order.id, "prepare")}
                  disabled={busyId === order.id}
                  className="btn btn-primary"
                  style={{ width: "100%", height: 38 }}
                >
                  <Flame size={16} />
                  <span>Iniciar preparación</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* COLUMNA 2: EN PREPARACIÓN */}
        <div
          style={{
            backgroundColor: "var(--color-surface-secondary)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--color-primary)" }} />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>En preparación</h3>
              <span className="badge badge-info" style={{ height: 22, fontSize: 11, padding: "0 8px" }}>
                {enPrep.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>En fogón / plancha</span>
          </div>

          {enPrep.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              Ninguna orden en preparación
            </div>
          ) : (
            enPrep.map((order) => (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>#{order.id}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", marginLeft: 8 }}>
                      Mesa {getTableNumber(order.table_session_id)}
                    </span>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: 11 }}>
                    <Clock size={12} />
                    {getMinutesAgo(order.created_at)}
                  </span>
                </div>

                {/* Items */}
                <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 10, borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {order.lines.map((line, idx) => (
                    <div key={idx}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                        <span>{line.quantity} × {line.product_name}</span>
                      </div>
                      {line.notes && (
                        <div style={{ marginTop: 2, padding: "3px 8px", backgroundColor: "var(--color-warning-soft)", borderRadius: 4, fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>
                          ● {line.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action */}
                <button
                  onClick={() => handleAdvance(order.id, "ready")}
                  disabled={busyId === order.id}
                  className="btn"
                  style={{
                    width: "100%",
                    height: 38,
                    backgroundColor: "var(--color-tertiary)",
                    color: "#ffffff",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Marcar como listo</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* COLUMNA 3: LISTOS PARA SERVIR */}
        <div
          style={{
            backgroundColor: "var(--color-surface-secondary)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--color-tertiary)" }} />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Listos para servir</h3>
              <span className="badge badge-success" style={{ height: 22, fontSize: 11, padding: "0 8px" }}>
                {listos.length}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Avisar a mesero</span>
          </div>

          {listos.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              No hay pedidos en pase
            </div>
          ) : (
            listos.map((order) => (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>#{order.id}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-tertiary)", marginLeft: 8 }}>
                      Mesa {getTableNumber(order.table_session_id)}
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>
                    <Check size={12} />
                    Listo
                  </span>
                </div>

                {/* Items */}
                <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 10, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {order.lines.map((line, idx) => (
                    <div key={idx} style={{ fontSize: 13, fontWeight: 600 }}>
                      <span>{line.quantity} × {line.product_name}</span>
                    </div>
                  ))}
                </div>

                {/* Status: Esperando servicio por mesero */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "8px 12px",
                    backgroundColor: "var(--color-tertiary-soft)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-tertiary)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Listo en pase — Esperando mesero</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
