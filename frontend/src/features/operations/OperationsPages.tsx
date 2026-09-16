import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { apiRequest } from "../../services/api";
function PendingModule({ title }: { title: string }) {
  return (
    <main className="app-shell">
      <Link to="/">← Inicio</Link>
      <h1>{title}</h1>
      <p>
        Este módulo aún no está habilitado. No se pueden registrar operaciones
        aquí.
      </p>
    </main>
  );
}
export function InventoryPage() {
  return <PendingModule title="Inventario" />;
}
export function PurchasesPage() {
  return <PendingModule title="Compras y proveedores" />;
}
export function PaymentsPage() {
  return <PendingModule title="Pagos y caja" />;
}
export function CostsPage() {
  return <PendingModule title="Costos y gastos" />;
}
export function ReportsPage() {
  return <PendingModule title="Reportes" />;
}
type Order = {
  id: number;
  state: string;
  created_at: string;
  lines: { product_name: string; quantity: number; notes: string | null }[];
};
export function KitchenPage() {
  const { accessToken, hasPermission } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      setOrders(
        await apiRequest<Order[]>("/tables-orders/orders", {}, accessToken!),
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [accessToken]);
  async function advance(order: Order) {
    const action: Record<string, string> = {
      CONFIRMADO: "send-kitchen",
      EN_COCINA: "prepare",
      EN_PREPARACION: "ready",
    };
    setBusy(true);
    try {
      await apiRequest(
        `/tables-orders/orders/${order.id}/${action[order.state]}`,
        { method: "POST" },
        accessToken!,
      );
      await load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = orders.filter((order) =>
    ["CONFIRMADO", "EN_COCINA", "EN_PREPARACION", "LISTO"].includes(
      order.state,
    ),
  );
  return (
    <main className="app-shell">
      <Link to="/">← Inicio</Link>
      <h1>Cocina</h1>
      <button disabled={busy} onClick={load}>
        Actualizar pedidos
      </button>
      {busy && <p role="status">Cargando…</p>}
      {message && <p role="alert">{message}</p>}
      <div className="operations-grid">
        {visible.map((order) => (
          <article className="operation-card" key={order.id}>
            <h2>Pedido #{order.id}</h2>
            <p>{order.state}</p>
            <p>{new Date(order.created_at).toLocaleString("es-CO")}</p>
            {order.lines.map((line, index) => (
              <p key={index}>
                {line.quantity} × {line.product_name}
                {line.notes && <strong> · {line.notes}</strong>}
              </p>
            ))}
            {order.state !== "LISTO" && hasPermission("order.prepare") && (
              <button disabled={busy} onClick={() => advance(order)}>
                {order.state === "CONFIRMADO"
                  ? "Recibir en cocina"
                  : order.state === "EN_COCINA"
                    ? "Iniciar preparación"
                    : "Marcar listo"}
              </button>
            )}
          </article>
        ))}
      </div>
      {!busy && !message && visible.length === 0 && (
        <p>No hay pedidos en cocina.</p>
      )}
    </main>
  );
}
type Audit = {
  id: number;
  action: string;
  actor_user_id: number | null;
  created_at: string;
  entity_type?: string;
  entity_id?: number;
};
export function AuditSettingsPage() {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState<Audit[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const [auth, catalog] = await Promise.all([
        apiRequest<Audit[]>("/audit", {}, accessToken!),
        apiRequest<Audit[]>("/catalog/audit", {}, accessToken!),
      ]);
      setEvents(
        [...auth, ...catalog].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        ),
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [accessToken]);
  return (
    <main className="app-shell">
      <Link to="/">← Inicio</Link>
      <h1>Auditoría</h1>
      <button disabled={busy} onClick={load}>
        Actualizar eventos
      </button>
      {busy && <p role="status">Cargando…</p>}
      {message && <p role="alert">{message}</p>}
      {events.map((event, index) => (
        <article className="operation-card" key={index}>
          <strong>{event.action}</strong>
          <p>
            Usuario {event.actor_user_id ?? "No identificado"} ·{" "}
            {new Date(event.created_at).toLocaleString("es-CO")}
          </p>
          {event.entity_type && (
            <p>
              {event.entity_type} #{event.entity_id}
            </p>
          )}
        </article>
      ))}
      {!busy && !message && !events.length && (
        <p>No hay eventos registrados.</p>
      )}
    </main>
  );
}
