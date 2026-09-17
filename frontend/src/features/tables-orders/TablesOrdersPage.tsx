import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Drawer } from "../../components/Drawer";
import { IconButton } from "../../components/IconButton";
import {
  Armchair,
  Users,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  UtensilsCrossed,
  X,
  CreditCard,
  Send,
  FileText,
  AlertCircle,
  Edit,
  Minus,
  Check,
  Printer,
  Lock,
  Eye,
} from "lucide-react";

type Table = {
  id: number;
  number: string;
  capacity?: number;
  is_active?: boolean;
  state: "DISPONIBLE" | "OCUPADA" | "EN_ATENCION" | "PENDIENTE_PAGO" | "PAGO_PARCIAL" | string;
  active_session: {
    id: number;
    waiter_id: number;
    people_count: number;
    opened_at: string;
  } | null;
};

type OrderLine = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
};

type Order = {
  id: number;
  table_session_id: number;
  state: string;
  lines: OrderLine[];
  account_requested?: boolean;
  notes?: string;
};

type Product = {
  id: number;
  name: string;
  description: string;
  current_price: number;
  category_id?: number;
  category_name?: string;
  category?: { id: number; name: string };
  is_available: boolean;
  is_active?: boolean;
  image_reference?: string;
};

export function TablesOrdersPage() {
  const { accessToken, hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const token = accessToken!;

  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters & State
  const [filterState, setFilterState] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal: Open Table
  const [openTableModal, setOpenTableModal] = useState<Table | null>(null);
  const [peopleCount, setPeopleCount] = useState(2);

  // Modal: POS / Toma de Pedido
  const [posTable, setPosTable] = useState<Table | null>(null);
  const [activeExistingOrder, setActiveExistingOrder] = useState<Order | null>(null);
  const [cartLines, setCartLines] = useState<OrderLine[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Modal: Table Details
  const [detailTable, setDetailTable] = useState<Table | null>(null);

  // Modal: Prefactura
  const [prefacturaTable, setPrefacturaTable] = useState<Table | null>(null);
  const [prefacturaSummary, setPrefacturaSummary] = useState<any | null>(null);
  const [loadingPrefactura, setLoadingPrefactura] = useState(false);

  // Drawer: Table CRUD
  const [tableDrawerOpen, setTableDrawerOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableNumberInput, setTableNumberInput] = useState("");
  const [tableCapacityInput, setTableCapacityInput] = useState(4);
  const [tableIsActiveInput, setTableIsActiveInput] = useState(true);
  const [savingTable, setSavingTable] = useState(false);

  function openCreateTableDrawer() {
    setEditingTable(null);
    setTableNumberInput(`Mesa ${tables.length + 1}`);
    setTableCapacityInput(4);
    setTableIsActiveInput(true);
    setTableDrawerOpen(true);
  }

  function openEditTableDrawer(table: Table) {
    setEditingTable(table);
    setTableNumberInput(table.number);
    setTableCapacityInput(table.capacity || 4);
    setTableIsActiveInput(table.is_active !== false);
    setTableDrawerOpen(true);
  }

  async function handleSaveTable(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingTable(true);
      if (editingTable) {
        await apiRequest(
          `/tables-orders/tables/${editingTable.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              number: tableNumberInput,
              capacity: Number(tableCapacityInput),
              is_active: tableIsActiveInput,
            }),
          },
          token
        );
      } else {
        await apiRequest(
          "/tables-orders/tables",
          {
            method: "POST",
            body: JSON.stringify({
              number: tableNumberInput,
              capacity: Number(tableCapacityInput),
            }),
          },
          token
        );
      }
      setTableDrawerOpen(false);
      setEditingTable(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingTable(false);
    }
  }

  async function handleDeleteOrInactivateTable(tableId: number) {
    if (!window.confirm("¿Seguro que deseas eliminar o inactivar esta mesa?")) return;
    try {
      setSavingTable(true);
      const res = await apiRequest<any>(
        `/tables-orders/tables/${tableId}`,
        { method: "DELETE" },
        token
      );
      if (res?.action === "deactivated") {
        setMessage("La mesa contiene historial operativo y fue inactivada correctamente.");
      } else {
        setMessage("Mesa eliminada con éxito.");
      }
      setTableDrawerOpen(false);
      setEditingTable(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSavingTable(false);
    }
  }

  const [posSearchTerm, setPosSearchTerm] = useState("");

  const mediaUrl = (ref?: string) => {
    if (!ref) return null;
    if (ref.startsWith("http")) return ref;
    return `/media/products/${ref}`;
  };

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val));

  async function loadData() {
    try {
      setLoading(true);
      const [tRes, oRes, pRes, cRes] = await Promise.all([
        apiRequest<any>("/tables-orders/tables", {}, token).catch(() => []),
        apiRequest<any>("/tables-orders/orders", {}, token).catch(() => []),
        apiRequest<any>("/tables-orders/menu-items", {}, token).catch(async () => {
          return apiRequest<any>("/catalog/products?page_size=100", {}, token).catch(() => []);
        }),
        apiRequest<any>("/catalog/categories", {}, token).catch(() => []),
      ]);
      const tableList = Array.isArray(tRes) ? tRes : (tRes?.items || []);
      const orderList = Array.isArray(oRes) ? oRes : (oRes?.items || []);
      const prodList = Array.isArray(pRes) ? pRes : (pRes?.items || []);
      const catList = Array.isArray(cRes) ? cRes : (cRes?.items || []);

      setTables(tableList);
      setOrders(orderList);
      setProducts(
        prodList.filter(
          (p: any) => p && p.is_active !== false && p.is_available !== false
        )
      );
      setCategories(catList);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Open Table Session
  async function handleOpenTable(e: React.FormEvent) {
    e.preventDefault();
    if (!openTableModal) return;
    try {
      await apiRequest(
        `/tables-orders/tables/${openTableModal.id}/open`,
        {
          method: "POST",
          body: JSON.stringify({ people_count: peopleCount }),
        },
        token
      );
      setOpenTableModal(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Cart Handlers
  function addToCart(product: Product) {
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.product_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.current_price,
          notes: "",
        },
      ];
    });
  }

  function updateQuantity(productId: number, delta: number) {
    setCartLines((prev) =>
      prev
        .map((l) => {
          if (l.product_id === productId) {
            const nextQ = l.quantity + delta;
            return nextQ > 0 ? { ...l, quantity: nextQ } : null;
          }
          return l;
        })
        .filter(Boolean) as OrderLine[]
    );
  }

  function updateLineNote(productId: number, notes: string) {
    setCartLines((prev) =>
      prev.map((l) => (l.product_id === productId ? { ...l, notes } : l))
    );
  }

  const formatTableName = (num?: string) =>
    !num ? "Mesa" : num.trim().toLowerCase().startsWith("mesa") ? num.trim() : `Mesa ${num.trim()}`;

  function openPosForTable(table: Table) {
    const tOrders = orders.filter(
      (o) => o.table_session_id === table.active_session?.id && o.state !== "CANCELADO"
    );
    const existing = tOrders.length > 0 ? tOrders[tOrders.length - 1] : null;
    setActiveExistingOrder(existing);
    setPosTable(table);
    setSelectedCat(null);
    setPosSearchTerm("");

    if (existing) {
      setCartLines(
        existing.lines.map((l: any) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: Number(l.unit_price),
          notes: l.notes || "",
        }))
      );
    } else {
      setCartLines([]);
    }
  }

  async function openPrefactura(table: Table) {
    try {
      setLoadingPrefactura(true);
      setPrefacturaTable(table);
      const summary = await apiRequest<any>(`/cash/tables/${table.id}/summary`, {}, token);
      setPrefacturaSummary(summary);
    } catch (err) {
      setMessage((err as Error).message);
      setPrefacturaTable(null);
      setPrefacturaSummary(null);
    } finally {
      setLoadingPrefactura(false);
    }
  }

  async function handleDeliverOrder(orderId: number) {
    try {
      await apiRequest(`/tables-orders/orders/${orderId}/deliver`, { method: "POST" }, token);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Send / Update Order
  async function handleSendOrder() {
    if (!posTable || !posTable.active_session || cartLines.length === 0) return;
    try {
      if (activeExistingOrder) {
        if (["EN_PREPARACION", "LISTO", "ENTREGADO"].includes(activeExistingOrder.state)) {
          setMessage("No se pueden modificar comandas en preparación o entregadas.");
          return;
        }
        await apiRequest(
          `/tables-orders/orders/${activeExistingOrder.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              lines: cartLines.map((l) => ({
                product_id: l.product_id,
                quantity: l.quantity,
                notes: l.notes || undefined,
              })),
            }),
          },
          token
        );
        if (activeExistingOrder.state === "BORRADOR" || activeExistingOrder.state === "PENDIENTE") {
          await apiRequest(`/tables-orders/orders/${activeExistingOrder.id}/confirm`, { method: "POST" }, token).catch(() => {});
          await apiRequest(`/tables-orders/orders/${activeExistingOrder.id}/send-kitchen`, { method: "POST" }, token).catch(() => {});
        }
      } else {
        // 1. Create order
        const order = await apiRequest<Order>(
          "/tables-orders/orders",
          {
            method: "POST",
            body: JSON.stringify({
              table_session_id: posTable.active_session.id,
              lines: cartLines.map((l) => ({
                product_id: l.product_id,
                quantity: l.quantity,
                notes: l.notes || undefined,
              })),
            }),
          },
          token
        );

        // 2. Confirm order & send to kitchen
        await apiRequest(`/tables-orders/orders/${order.id}/confirm`, { method: "POST" }, token);
        await apiRequest(`/tables-orders/orders/${order.id}/send-kitchen`, { method: "POST" }, token);
      }

      setPosTable(null);
      setActiveExistingOrder(null);
      setCartLines([]);
      setOrderNotes("");
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Request Account
  async function handleRequestAccount(tableId: number) {
    try {
      await apiRequest(`/tables-orders/tables/${tableId}/request-account`, { method: "POST" }, token);
      setDetailTable(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const tableOrders = (tableSessionId?: number) =>
    orders.filter((o) => o.table_session_id === tableSessionId && o.state !== "CANCELADO");

  const activeTables = tables.filter((t) => t.is_active !== false);

  const filteredTables = tables.filter((t) => {
    if (filterState === "INACTIVA") {
      if (t.is_active !== false) return false;
    } else {
      if (t.is_active === false) return false;
      if (filterState === "DISPONIBLE") {
        if (t.state !== "DISPONIBLE" && Boolean(t.active_session)) return false;
      } else if (filterState === "OCUPADA") {
        if (t.state === "DISPONIBLE" || t.state === "CUENTA_SOLICITADA" || t.state === "PENDIENTE_PAGO" || t.state === "PAGO_PARCIAL" || !t.active_session) return false;
      } else if (filterState === "CUENTA_SOLICITADA") {
        if (t.state !== "CUENTA_SOLICITADA" && t.state !== "PENDIENTE_PAGO" && t.state !== "PAGO_PARCIAL") return false;
      }
    }
    if (searchTerm && !t.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const cartSubtotal = cartLines.reduce(
    (acc, l) => acc + l.quantity * Number(l.unit_price),
    0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER & ACTIONS */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Mesas y Pedidos
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Consulta y gestiona la operación actual de las mesas de POTOQUITOS en tiempo real.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={openCreateTableDrawer}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            id="btn-new-table"
          >
            <Plus size={18} />
            <span>+ Nueva mesa</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="alert-box alert-danger" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")}><X size={16} /></button>
        </div>
      )}

      {/* 4 MINI OPERATIONAL METRICS (Stitch mesas_y_pedidos) */}
      <div className="grid-4">
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Total en Salón
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 2 }}>
              {activeTables.length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Capacidad activa 100%</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-surface-secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
            <Armchair size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-tertiary)", fontWeight: 700 }}>
              Disponibles
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-tertiary)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state === "DISPONIBLE" || !t.active_session).length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Listas para asignación</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-tertiary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-tertiary)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-primary)", fontWeight: 700 }}>
              En atención
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state !== "DISPONIBLE" && t.state !== "CUENTA_SOLICITADA" && t.state !== "PENDIENTE_PAGO" && t.state !== "PAGO_PARCIAL" && Boolean(t.active_session)).length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>En servicio / preparación</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
            <Users size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-warning)", fontWeight: 700 }}>
              Cuenta solicitada
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-warning)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state === "CUENTA_SOLICITADA" || t.state === "PENDIENTE_PAGO" || t.state === "PAGO_PARCIAL").length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Cobro pendiente / Caja</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-warning-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-warning)" }}>
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR (Stitch mesas_y_pedidos) */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 18px",
          border: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterState("ALL")}
            className={`btn btn-sm ${filterState === "ALL" ? "btn-primary" : "btn-secondary"}`}
          >
            Todas ({activeTables.length})
          </button>
          <button
            onClick={() => setFilterState("DISPONIBLE")}
            className={`btn btn-sm ${filterState === "DISPONIBLE" ? "btn-primary" : "btn-secondary"}`}
          >
            Disponibles ({activeTables.filter((t) => t.state === "DISPONIBLE" || !t.active_session).length})
          </button>
          <button
            onClick={() => setFilterState("OCUPADA")}
            className={`btn btn-sm ${filterState === "OCUPADA" ? "btn-primary" : "btn-secondary"}`}
          >
            En atención ({activeTables.filter((t) => t.state !== "DISPONIBLE" && t.state !== "CUENTA_SOLICITADA" && t.state !== "PENDIENTE_PAGO" && t.state !== "PAGO_PARCIAL" && Boolean(t.active_session)).length})
          </button>
          <button
            onClick={() => setFilterState("CUENTA_SOLICITADA")}
            className={`btn btn-sm ${filterState === "CUENTA_SOLICITADA" ? "btn-primary" : "btn-secondary"}`}
          >
            Cuenta solicitada ({activeTables.filter((t) => t.state === "CUENTA_SOLICITADA" || t.state === "PENDIENTE_PAGO" || t.state === "PAGO_PARCIAL").length})
          </button>
          {tables.some((t) => t.is_active === false) && (
            <button
              onClick={() => setFilterState("INACTIVA")}
              className={`btn btn-sm ${filterState === "INACTIVA" ? "btn-danger" : "btn-secondary"}`}
            >
              Inactivas ({tables.filter((t) => t.is_active === false).length})
            </button>
          )}
        </div>

        <div style={{ position: "relative", width: 240 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Buscar mesa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 36, height: 36, fontSize: 13 }}
          />
        </div>
      </div>

      {/* GRID OF TABLES (Stitch Table Cards) */}
      <div className="grid-4">
        {filteredTables.map((table) => {
          const isAvailable = table.state === "DISPONIBLE" || !table.active_session;
          const isInactive = table.is_active === false;
          const isPendingPay = table.state === "PENDIENTE_PAGO" || table.state === "PAGO_PARCIAL";
          const tOrders = tableOrders(table.active_session?.id);
          const latestOrder = tOrders.length > 0 ? tOrders[tOrders.length - 1] : null;

          let stateLabel = "Disponible";
          let badgeClass = "badge-neutral";
          let stateCode = "DISPONIBLE";

          if (isInactive) {
            stateLabel = "Inactiva";
            badgeClass = "badge-danger";
            stateCode = "INACTIVA";
          } else if (isAvailable) {
            stateLabel = "Disponible";
            badgeClass = "badge-neutral";
            stateCode = "DISPONIBLE";
          } else if (table.state === "PAGO_PARCIAL") {
            stateLabel = "Pago parcial";
            badgeClass = "badge-warning";
            stateCode = "PAGO_PARCIAL";
          } else if (table.state === "CUENTA_SOLICITADA" || table.state === "PENDIENTE_PAGO") {
            stateLabel = "Cuenta solicitada";
            badgeClass = "badge-secondary";
            stateCode = "CUENTA_SOLICITADA";
          } else if (table.state === "PAGADO") {
            stateLabel = "Pagado";
            badgeClass = "badge-success";
            stateCode = "PAGADO";
          } else if (!latestOrder || table.state === "SIN_PEDIDO") {
            stateLabel = "Sin pedido";
            badgeClass = "badge-neutral";
            stateCode = "SIN_PEDIDO";
          } else {
            const ordState = latestOrder.state;
            if (ordState === "ENTREGADO" || table.state === "ENTREGADO") {
              stateCode = "ENTREGADO";
              stateLabel = "Entregado";
              badgeClass = "badge-primary";
            } else if (ordState === "LISTO" || table.state === "LISTO") {
              stateCode = "LISTO";
              stateLabel = "LISTO PARA SERVIR";
              badgeClass = "badge-tertiary";
            } else if (ordState === "EN_PREPARACION" || table.state === "EN_PREPARACION") {
              stateCode = "EN_PREPARACION";
              stateLabel = "En preparación";
              badgeClass = "badge-info";
            } else if (ordState === "PAGADO" || table.state === "PAGADO") {
              stateCode = "PAGADO";
              stateLabel = "Pagado";
              badgeClass = "badge-success";
            } else {
              stateCode = "PENDIENTE";
              stateLabel = "Pendiente";
              badgeClass = "badge-warning";
            }
          }

          const tableTotal = tOrders.reduce(
            (sum, o) =>
              sum +
              o.lines.reduce(
                (lSum, l) => lSum + l.quantity * Number(l.unit_price),
                0
              ),
            0
          );

          return (
            <div
              key={table.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderColor:
                  stateCode === "PAGO_PARCIAL" || stateCode === "CUENTA_SOLICITADA"
                    ? "var(--color-warning)"
                    : stateCode === "LISTO"
                    ? "var(--color-tertiary)"
                    : !isAvailable
                    ? "var(--color-primary)"
                    : "var(--color-border)",
              }}
            >
              <div>
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 10,
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>
                      {table.number.startsWith("Mesa") ? table.number : `Mesa ${table.number}`}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Salón</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`badge ${badgeClass}`}>
                      <span className="badge-dot" />
                      {stateLabel}
                    </span>
                    <button
                      type="button"
                      title="Editar mesa"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditTableDrawer(table);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-text-muted)",
                        padding: 4,
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={16} />
                      <span>
                        {isAvailable
                          ? `Capacidad: ${table.capacity || 4} personas`
                          : `${table.active_session?.people_count || 1} comensales en mesa`}
                      </span>
                    </div>
                    {latestOrder && (
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        Pedido #{latestOrder.id}
                      </span>
                    )}
                  </div>

                  {!isAvailable && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <Clock size={16} />
                        <span>
                          Abierta:{" "}
                          {new Date(table.active_session?.opened_at || "").toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 4,
                          paddingTop: 6,
                          borderTop: "1px dashed var(--color-border)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          Total comanda:
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {formatCOP(tableTotal)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  paddingTop: 10,
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {isAvailable ? (
                  <button
                    onClick={() => {
                      setOpenTableModal(table);
                      setPeopleCount(2);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%" }}
                  >
                    <Plus size={16} />
                    <span>Abrir mesa</span>
                  </button>
                ) : stateCode === "SIN_PEDIDO" ? (
                  <>
                    <button
                      onClick={() => openPosForTable(table)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      title="Tomar pedido inicial"
                    >
                      <UtensilsCrossed size={16} />
                      <span>Tomar pedido</span>
                    </button>
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver información de mesa"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                ) : stateCode === "LISTO" && latestOrder ? (
                  <>
                    <button
                      onClick={() => handleDeliverOrder(latestOrder.id)}
                      className="btn btn-sm"
                      style={{
                        backgroundColor: "var(--color-tertiary)",
                        color: "#ffffff",
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        fontWeight: 700,
                      }}
                      title="Marcar como entregado"
                    >
                      <CheckCircle2 size={16} />
                      <span>Marcar como entregado</span>
                    </button>
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver comanda"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                ) : stateCode === "ENTREGADO" ? (
                  <>
                    <button
                      onClick={() => handleRequestAccount(table.id)}
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      title="Solicitar cuenta"
                    >
                      <Clock size={16} />
                      <span>Solicitar cuenta</span>
                    </button>
                    <IconButton
                      icon={Printer}
                      variant="default"
                      size="sm"
                      tooltip="Imprimir prefactura"
                      onClick={() => openPrefactura(table)}
                    />
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver comanda"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                ) : stateCode === "CUENTA_SOLICITADA" || stateCode === "PAGO_PARCIAL" ? (
                  <>
                    <button
                      onClick={() => openPrefactura(table)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      title="Imprimir prefactura"
                    >
                      <Printer size={16} />
                      <span>Prefactura</span>
                    </button>
                    <span
                      className="badge badge-secondary"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 11 }}
                      title="Cuenta habilitada para cobro en Caja"
                    >
                      <CreditCard size={13} />
                      En Caja
                    </span>
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver comanda y cuenta"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                ) : stateCode === "EN_PREPARACION" ? (
                  <>
                    <button
                      onClick={() => openPosForTable(table)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      title="Ver comanda (En preparación en cocina - Bloqueada)"
                    >
                      <Lock size={15} />
                      <span>Ver pedido</span>
                    </button>
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver comanda"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openPosForTable(table)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      title="Modificar pedido"
                    >
                      <UtensilsCrossed size={16} />
                      <span>Modificar</span>
                    </button>
                    <IconButton
                      icon={FileText}
                      variant="default"
                      size="sm"
                      tooltip="Ver comanda"
                      onClick={() => setDetailTable(table)}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRAWER: ABRIR MESA */}
      <Drawer
        isOpen={Boolean(openTableModal)}
        onClose={() => setOpenTableModal(null)}
        title={openTableModal ? `Abrir ${formatTableName(openTableModal.number)}` : "Abrir Mesa"}
        subtitle="Ingresa el número de comensales para asignar la sesión a tu turno."
        width="sm"
        footer={
          <>
            <button type="button" onClick={() => setOpenTableModal(null)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-open-table" className="btn btn-primary">
              Confirmar apertura
            </button>
          </>
        }
      >
        {openTableModal && (
          <form id="form-open-table" onSubmit={handleOpenTable} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Número de comensales *</label>
              <input
                type="number"
                min={1}
                max={20}
                value={peopleCount}
                onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="form-input"
                required
              />
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                Se abrirá la comanda vinculada a tu turno de mesero.
              </span>
            </div>
          </form>
        )}
      </Drawer>

      {/* DRAWER: POS TOMA DE PEDIDO O DETALLE DE COMANDA BLOQUEADA */}
      {posTable && (() => {
        const isOrderLocked = Boolean(
          activeExistingOrder &&
            ["EN_PREPARACION", "LISTO", "ENTREGADO", "CUENTA_SOLICITADA", "PAGO_PARCIAL", "PAGADO"].includes(
              activeExistingOrder.state
            )
        );

        const drawerTitle = isOrderLocked
          ? `Detalle del Pedido #${activeExistingOrder?.id} — ${formatTableName(posTable.number)}`
          : `Toma de Pedido — ${formatTableName(posTable.number)}${
              activeExistingOrder ? ` (Pedido #${activeExistingOrder.id})` : ""
            }`;

        const drawerSubtitle = isOrderLocked
          ? `Estado de la comanda: ${activeExistingOrder?.state}. Modo consulta (bloqueada contra modificaciones).`
          : activeExistingOrder
          ? `Estado comanda: ${activeExistingOrder.state}. Agrega o ajusta platos y bebidas.`
          : "Selecciona los platos y bebidas para enviar la orden a cocina.";

        return (
          <Drawer
            isOpen={Boolean(posTable)}
            onClose={() => setPosTable(null)}
            title={drawerTitle}
            subtitle={drawerSubtitle}
            width={isOrderLocked ? "lg" : "xl"}
            footer={
              isOrderLocked ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Total comanda:</span>
                    <strong style={{ fontSize: 18, color: "var(--color-text-primary)" }}>{formatCOP(cartSubtotal)}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(activeExistingOrder?.state === "ENTREGADO" ||
                      activeExistingOrder?.state === "CUENTA_SOLICITADA" ||
                      activeExistingOrder?.state === "PAGO_PARCIAL") && (
                      <button
                        type="button"
                        onClick={() => {
                          const t = posTable;
                          setPosTable(null);
                          openPrefactura(t);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Printer size={16} />
                        <span>Prefactura</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPosTable(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : undefined
            }
          >
            {isOrderLocked ? (
              /* MODO CONSULTA (Comanda Bloqueada: EN_PREPARACION, LISTO, ENTREGADO, etc.) */
              <div className="order-consultation-view">
                {/* Status banner */}
                <div
                  className="alert-box alert-warning"
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: "var(--radius-md)" }}
                >
                  <Lock size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <strong>Comanda bloqueada:</strong> El pedido #{activeExistingOrder?.id} se encuentra en estado{" "}
                    <span className="badge badge-warning" style={{ height: 20, fontSize: 11, padding: "0 8px", verticalAlign: "middle" }}>
                      {activeExistingOrder?.state}
                    </span>
                    . Por política de cocina y control estricto de inventario, no se permiten modificaciones ni adiciones de productos en este pedido.
                  </div>
                </div>

                {/* Table Summary Meta Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <div style={{ padding: "10px 12px", backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Mesa asignada</span>
                    <strong style={{ fontSize: 15, color: "var(--color-text-primary)" }}>Mesa {posTable.number}</strong>
                  </div>
                  <div style={{ padding: "10px 12px", backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Comensales</span>
                    <strong style={{ fontSize: 15, color: "var(--color-text-primary)" }}>{posTable.active_session?.people_count || 1} personas</strong>
                  </div>
                  <div style={{ padding: "10px 12px", backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Ítems comandados</span>
                    <strong style={{ fontSize: 15, color: "var(--color-text-primary)" }}>{cartLines.length} productos</strong>
                  </div>
                </div>

                {/* Items Table */}
                <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "var(--color-surface)" }}>
                  <div style={{ overflowX: "auto" }} className="custom-scrollbar">
                    <table className="order-items-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th style={{ textAlign: "center", width: 70 }}>Cant.</th>
                          <th style={{ textAlign: "right", width: 110 }}>Precio Unit.</th>
                          <th style={{ textAlign: "right", width: 120 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartLines.map((line) => (
                          <tr key={line.product_id}>
                            <td>
                              <span style={{ fontWeight: 700, color: "var(--color-text-primary)", display: "block" }}>
                                {line.product_name}
                              </span>
                              {line.notes && (
                                <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic", marginTop: 2 }}>
                                  Nota: {line.notes}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 700, color: "var(--color-text-primary)" }}>
                              {line.quantity}
                            </td>
                            <td style={{ textAlign: "right", color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCOP(Number(line.unit_price))}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCOP(line.quantity * Number(line.unit_price))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Box */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{
                    minWidth: "220px",
                    padding: "12px 16px",
                    backgroundColor: "var(--color-surface-secondary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      <span>Subtotal consumo:</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCOP(cartSubtotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--color-text-primary)", borderTop: "1px solid var(--color-border)", paddingTop: 6 }}>
                      <span>Total comanda:</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCOP(cartSubtotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* MODO EDICIÓN (PENDIENTE / Borrador) */
              <div className="pos-drawer-grid">
                {/* LEFT: PRODUCTS LIST & CATEGORY PILLS */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                  {/* Category Pills */}
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, maxWidth: "100%" }} className="custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCat(null)}
                      className={`btn ${selectedCat === null ? "btn-primary" : "btn-secondary"} btn-sm`}
                      style={{ borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      Todos
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCat(c.id)}
                        className={`btn ${selectedCat === c.id ? "btn-primary" : "btn-secondary"} btn-sm`}
                        style={{ borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Search Menu Input */}
                  <div style={{ position: "relative", width: "100%" }}>
                    <Search size={16} color="var(--color-text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      placeholder="Buscar ítem del menú..."
                      value={posSearchTerm}
                      onChange={(e) => setPosSearchTerm(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: 34, fontSize: 13, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Products Cards Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: 10,
                      maxHeight: "420px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      paddingRight: 4,
                      boxSizing: "border-box",
                      alignContent: "start",
                    }}
                    className="custom-scrollbar"
                  >
                    {products
                      .filter((p) => {
                        if (selectedCat !== null && p.category_id !== selectedCat) return false;
                        if (posSearchTerm.trim() && !p.name.toLowerCase().includes(posSearchTerm.toLowerCase())) return false;
                        return true;
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => addToCart(item)}
                          style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            padding: 10,
                            cursor: "pointer",
                            backgroundColor: "var(--color-surface)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            transition: "all 0.15s ease",
                            minWidth: 0,
                          }}
                          className="hover-card"
                        >
                          <div>
                            <span style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase" }}>
                              {item.category_name || "Menú"}
                            </span>
                            <h5 style={{ fontSize: 12, fontWeight: 700, margin: "4px 0 2px 0", color: "var(--color-text-primary)", wordBreak: "break-word" }}>
                              {item.name}
                            </h5>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>
                              {formatCOP(Number(item.current_price))}
                            </span>
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: "var(--color-primary-soft)",
                                color: "var(--color-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Plus size={12} />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* RIGHT: CART / COMANDA BUILDER */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    minWidth: 0,
                    backgroundColor: "var(--color-surface-secondary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: 14,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                      {activeExistingOrder ? `Pedido #${activeExistingOrder.id}` : "Nueva Comanda"}
                    </h4>
                    <span className="badge badge-neutral">{cartLines.length} ítems</span>
                  </div>

                  <div
                    style={{
                      maxHeight: "320px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      paddingRight: 4,
                      boxSizing: "border-box",
                    }}
                    className="custom-scrollbar"
                  >
                    {cartLines.length === 0 ? (
                      <div style={{ padding: "35px 10px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                        <UtensilsCrossed size={30} style={{ margin: "0 auto 8px auto", opacity: 0.4 }} />
                        <p style={{ margin: 0 }}>Selecciona platos del menú izquierdo para armar el pedido.</p>
                      </div>
                    ) : (
                      cartLines.map((line) => (
                        <div
                          key={line.product_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                            gap: 8,
                            boxSizing: "border-box",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, display: "block", wordBreak: "break-word" }}>
                              {line.product_name}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                              {formatCOP(Number(line.unit_price))} c/u
                            </span>
                          </div>

                          {/* Stepper */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.product_id, -1)}
                              className="btn-icon"
                              style={{ width: 24, height: 24 }}
                              title="Disminuir cantidad"
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: "center" }}>
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.product_id, 1)}
                              className="btn-icon"
                              style={{ width: 24, height: 24 }}
                              title="Aumentar cantidad"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 60, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                            {formatCOP(line.quantity * Number(line.unit_price))}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Subtotal & Action */}
                  <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>Total comanda:</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatCOP(cartSubtotal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendOrder}
                      disabled={cartLines.length === 0}
                      className="btn btn-primary"
                      style={{ width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <Send size={16} />
                      <span>{activeExistingOrder ? "Guardar y Actualizar Pedido" : "Confirmar y Enviar a Cocina"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Drawer>
        );
      })()}

      {/* DRAWER: DETALLE DE MESA & CUENTA */}
      <Drawer
        isOpen={Boolean(detailTable)}
        onClose={() => setDetailTable(null)}
        title={detailTable ? `Detalle de ${formatTableName(detailTable.number)}` : "Detalle de Mesa"}
        subtitle={detailTable ? `${detailTable.active_session?.people_count || 1} comensales • Estado: ${detailTable.state}` : ""}
        size="md"
        footer={
          detailTable && (() => {
            const tOrders = tableOrders(detailTable.active_session?.id);
            const latOrd = tOrders.length > 0 ? tOrders[tOrders.length - 1] : null;
            const isDelivered = latOrd?.state === "ENTREGADO" || detailTable.state === "ENTREGADO";
            const isAccountRequested = detailTable.state === "CUENTA_SOLICITADA" || detailTable.state === "PENDIENTE_PAGO" || detailTable.state === "PAGO_PARCIAL";

            return (
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 10 }}>
                {(isDelivered || isAccountRequested) && (
                  <button
                    onClick={() => {
                      const tbl = detailTable;
                      setDetailTable(null);
                      openPrefactura(tbl);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Printer size={16} />
                    <span>Prefactura</span>
                  </button>
                )}

                {isDelivered && !isAccountRequested && (
                  <button
                    onClick={() => handleRequestAccount(detailTable.id)}
                    className="btn btn-primary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Clock size={16} />
                    <span>Solicitar cuenta</span>
                  </button>
                )}

                {isAccountRequested && (
                  <button
                    onClick={() => {
                      const tid = detailTable.id;
                      setDetailTable(null);
                      navigate(`/cash?table_id=${tid}`);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <CreditCard size={16} />
                    <span>Ir a Caja</span>
                  </button>
                )}

                {!isDelivered && !isAccountRequested && (
                  <button
                    onClick={() => setDetailTable(null)}
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: "auto" }}
                  >
                    Cerrar
                  </button>
                )}
              </div>
            );
          })()
        }
      >
        {detailTable && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Consumo acumulado</h4>
            {tableOrders(detailTable.active_session?.id).length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No hay comandas registradas en esta mesa.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tableOrders(detailTable.active_session?.id).map((ord) => (
                  <div key={ord.id} style={{ padding: 12, borderRadius: 8, backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>Comanda #{ord.id}</span>
                      <span className="badge badge-neutral" style={{ height: 20, fontSize: 10 }}>{ord.state}</span>
                    </div>
                    {ord.lines.map((l, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        <span>{l.quantity} × {l.product_name}</span>
                        <span style={{ fontWeight: 600 }}>{formatCOP(l.quantity * Number(l.unit_price))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* DRAWER LATERAL: CREAR / EDITAR MESA (Stitch slide-over) */}
      <Drawer
        isOpen={tableDrawerOpen}
        onClose={() => setTableDrawerOpen(false)}
        title={editingTable ? `Editar ${formatTableName(editingTable.number)}` : "Nueva Mesa"}
        subtitle="Configura la identificación, capacidad y estado de la mesa en salón"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "space-between" }}>
            {editingTable && (
              <button
                type="button"
                onClick={() => handleDeleteOrInactivateTable(editingTable.id)}
                className="btn btn-danger"
                disabled={savingTable}
              >
                <Trash2 size={16} />
                <span>Inactivar / Eliminar</span>
              </button>
            )}
            <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
              <button
                type="button"
                onClick={() => setTableDrawerOpen(false)}
                className="btn btn-secondary"
                disabled={savingTable}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-table-admin"
                className="btn btn-primary"
                disabled={savingTable}
              >
                {savingTable ? "Guardando..." : editingTable ? "Guardar Cambios" : "Crear Mesa"}
              </button>
            </div>
          </div>
        }
      >
        <form id="form-table-admin" onSubmit={handleSaveTable} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="form-group">
            <label className="form-label">Número o Identificador de Mesa *</label>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="Ej: Mesa 9, Barra 2, Terraza 1"
              value={tableNumberInput}
              onChange={(e) => setTableNumberInput(e.target.value)}
              className="form-input"
            />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              Nombre o número único con el que se identifica en comanda y factura.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Capacidad de Comensales *</label>
            <input
              type="number"
              required
              min={1}
              max={50}
              value={tableCapacityInput}
              onChange={(e) => setTableCapacityInput(Math.max(1, Number(e.target.value)))}
              className="form-input"
            />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              Cantidad estándar de sillas o puestos disponibles.
            </span>
          </div>

          {editingTable && (
            <div className="form-group">
              <label className="form-label">Estado de la Mesa</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={tableIsActiveInput}
                    onChange={(e) => setTableIsActiveInput(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span>Mesa Activa y Habilitada para Servicio</span>
                </label>
              </div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                Si se desmarca, la mesa se inactiva y no se ofertará en salón ni Dashboard.
              </span>
            </div>
          )}
        </form>
      </Drawer>

      {/* DRAWER: PREFACTURA / CUENTA PRELIMINAR (Stitch prefactura) */}
      <Drawer
        isOpen={Boolean(prefacturaTable && prefacturaSummary)}
        onClose={() => {
          setPrefacturaTable(null);
          setPrefacturaSummary(null);
        }}
        title={
          prefacturaTable
            ? `Prefactura — ${formatTableName(prefacturaTable.number)}`
            : "Prefactura"
        }
        subtitle="Cuenta preliminar de control para el comensal (NO ACREDITA PAGO)"
        size="lg"
        footer={
          <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => {
                setPrefacturaTable(null);
                setPrefacturaSummary(null);
              }}
              className="btn btn-secondary"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              id="btn-print-prefactura"
            >
              <Printer size={18} />
              <span>Imprimir prefactura</span>
            </button>
          </div>
        }
      >
        {prefacturaSummary && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                backgroundColor: "var(--color-surface-secondary)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.03em" }}>POTOQUITOS</div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                NIT: 901.458.789-2 · Régimen Simple
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                Calle 45 # 28 - 14, Barranquilla
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--color-primary-soft)",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: "0.04em",
                }}
              >
                PREFACTURA / CUENTA PRELIMINAR — NO ACREDITA PAGO
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                borderBottom: "1px solid var(--color-border)",
                paddingBottom: 8,
              }}
            >
              <div>
                <div>
                  Mesa: <strong>{prefacturaSummary.table_number}</strong>
                </div>
                <div>
                  Mesero: <strong>{prefacturaSummary.waiter_name || "Servicio"}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div>
                  Fecha: <strong>{new Date().toLocaleDateString("es-CO")}</strong>
                </div>
                <div>
                  Hora:{" "}
                  <strong>
                    {new Date().toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "var(--color-surface-secondary)" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Ítem</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", width: 40 }}>Cant</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", width: 75 }}>Unitario</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", width: 85 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {prefacturaSummary.items?.map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "6px 8px" }}>{it.name}</td>
                      <td style={{ textAlign: "center", padding: "6px 8px" }}>{it.ordered_qty}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px" }}>{formatCOP(it.unit_price)}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600 }}>
                        {formatCOP(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                backgroundColor: "var(--color-surface-secondary)",
                padding: 12,
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--color-text-secondary)" }}>Consumo total:</span>
                <span style={{ fontWeight: 600 }}>{formatCOP(prefacturaSummary.total_amount)}</span>
              </div>
              {Number(prefacturaSummary.total_paid) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-tertiary)" }}>
                  <span>Total pagado (abonos):</span>
                  <span style={{ fontWeight: 600 }}>- {formatCOP(prefacturaSummary.total_paid)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 15,
                  fontWeight: 800,
                  borderTop: "1px solid var(--color-border)",
                  paddingTop: 6,
                }}
              >
                <span>Saldo pendiente:</span>
                <span style={{ color: "var(--color-primary)" }}>{formatCOP(prefacturaSummary.pending_balance)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                <span>Propina voluntaria sugerida (10%):</span>
                <span style={{ fontWeight: 600 }}>
                  {formatCOP(Math.round(Number(prefacturaSummary.total_amount) * 0.1))}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
              * El aporte de servicio/propina es de carácter 100% voluntario. Este documento es un control previo de cuenta y no constituye comprobante fiscal de pago.
            </p>
          </div>
        )}
      </Drawer>

      {/* PRINT AREA FOR PREFACTURA (@media print) */}
      {prefacturaSummary && (
        <div className="potoquitos-receipt-print-area">
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.05em" }}>POTOQUITOS</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>RESTAURANTE & COMIDAS RÁPIDAS</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>NIT: 901.458.789-2 · Régimen Simple</div>
            <div style={{ fontSize: 10 }}>Calle 45 # 28 - 14, Barranquilla</div>
            <div style={{ fontSize: 10 }}>Tel: +57 300 123 4567</div>
          </div>

          <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", margin: "6px 0", textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 11 }}>PREFACTURA / CUENTA PRELIMINAR</div>
            <div style={{ fontWeight: 700, fontSize: 10 }}>NO ACREDITA PAGO</div>
          </div>

          <div style={{ fontSize: 11, marginBottom: 6 }}>
            <div>
              MESA: <strong>{prefacturaSummary.table_number}</strong>
            </div>
            <div>
              MESERO: <strong>{prefacturaSummary.waiter_name || "Servicio"}</strong>
            </div>
            <div>
              FECHA: {new Date().toLocaleDateString("es-CO")}{" "}
              {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", margin: "6px 0" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", width: "15%", padding: "2px 0" }}>Cant</th>
                <th style={{ textAlign: "left", width: "55%", padding: "2px 0" }}>Producto</th>
                <th style={{ textAlign: "right", width: "30%", padding: "2px 0" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {prefacturaSummary.items?.map((it: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ verticalAlign: "top", padding: "2px 0" }}>{it.ordered_qty}</td>
                  <td style={{ verticalAlign: "top", padding: "2px 0" }}>{it.name}</td>
                  <td style={{ textAlign: "right", verticalAlign: "top", padding: "2px 0" }}>{formatCOP(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", paddingTop: 4, marginTop: 4, fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CONSUMO TOTAL:</span>
              <span>{formatCOP(prefacturaSummary.total_amount)}</span>
            </div>
            {Number(prefacturaSummary.total_paid) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PAGADO (ABONOS):</span>
                <span>{formatCOP(prefacturaSummary.total_paid)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: 13,
                marginTop: 4,
                borderTop: "1px solid #000",
                paddingTop: 4,
              }}
            >
              <span>SALDO PENDIENTE:</span>
              <span>{formatCOP(prefacturaSummary.pending_balance)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
              <span>PROPINA SUGERIDA (10%):</span>
              <span>{formatCOP(Math.round(Number(prefacturaSummary.total_amount) * 0.1))}</span>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 10, fontSize: 9 }}>
            <div>El servicio/propina es estrictamente voluntario.</div>
            <div>Documento de control interno — No acredita pago.</div>
            <div>*** POTOQUITOS SOFTWARE V1.0 ***</div>
          </div>
        </div>
      )}
    </div>
  );
}
