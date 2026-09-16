import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Drawer } from "../../components/Drawer";
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
} from "lucide-react";

type Table = {
  id: number;
  number: string;
  capacity?: number;
  is_active?: boolean;
  state: "DISPONIBLE" | "OCUPADA" | "EN_ATENCION" | "PENDIENTE_PAGO" | string;
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
  const [cartLines, setCartLines] = useState<OrderLine[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Modal: Table Details
  const [detailTable, setDetailTable] = useState<Table | null>(null);

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

  // Send Order to Kitchen
  async function handleSendOrder() {
    if (!posTable || !posTable.active_session || cartLines.length === 0) return;
    try {
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

      setPosTable(null);
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
    orders.filter((o) => o.table_session_id === tableSessionId);

  const activeTables = tables.filter((t) => t.is_active !== false);

  const filteredTables = tables.filter((t) => {
    if (filterState === "INACTIVA") {
      if (t.is_active !== false) return false;
    } else {
      if (t.is_active === false) return false;
      if (filterState !== "ALL") {
        if (filterState === "OCUPADA" && !(t.state === "OCUPADA" || t.state === "EN_ATENCION")) return false;
        if (filterState !== "OCUPADA" && t.state !== filterState) return false;
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
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Disponibles
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-tertiary)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state === "DISPONIBLE").length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Listas para asignación</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-tertiary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-tertiary)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Ocupadas
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state === "OCUPADA" || t.state === "EN_ATENCION").length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>En atención</span>
          </div>
          <div style={{ width: 42, height: 42, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
            <Users size={22} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-warning)", fontWeight: 700 }}>
              Cuenta pedida
            </span>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-warning)", marginTop: 2 }}>
              {activeTables.filter((t) => t.state === "PENDIENTE_PAGO").length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Cobro pendiente</span>
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
            Disponibles ({activeTables.filter((t) => t.state === "DISPONIBLE").length})
          </button>
          <button
            onClick={() => setFilterState("OCUPADA")}
            className={`btn btn-sm ${filterState === "OCUPADA" ? "btn-primary" : "btn-secondary"}`}
          >
            En atención ({activeTables.filter((t) => t.state === "OCUPADA" || t.state === "EN_ATENCION").length})
          </button>
          <button
            onClick={() => setFilterState("PENDIENTE_PAGO")}
            className={`btn btn-sm ${filterState === "PENDIENTE_PAGO" ? "btn-primary" : "btn-secondary"}`}
          >
            Cuenta pedida ({activeTables.filter((t) => t.state === "PENDIENTE_PAGO").length})
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
          const isAvailable = table.state === "DISPONIBLE";
          const isPendingPay = table.state === "PENDIENTE_PAGO";
          const tOrders = tableOrders(table.active_session?.id);
          const hasOrders = tOrders.length > 0;
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
                borderColor: isPendingPay
                  ? "var(--color-warning)"
                  : !isAvailable
                  ? "var(--color-primary)"
                  : "var(--color-border)",
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>
                      {table.number.startsWith("Mesa") ? table.number : `Mesa ${table.number}`}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Salón</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {table.is_active === false ? (
                      <span className="badge badge-danger">Inactiva</span>
                    ) : isAvailable ? (
                      <span className="badge badge-neutral"><span className="badge-dot" />Disponible</span>
                    ) : isPendingPay ? (
                      <span className="badge badge-warning"><span className="badge-dot" />Cuenta pedida</span>
                    ) : (
                      <span className="badge badge-info"><span className="badge-dot" />Ocupada</span>
                    )}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
                    <Users size={16} />
                    <span>
                      {isAvailable
                        ? `Capacidad: ${table.capacity || 4} personas`
                        : `${table.active_session?.people_count || 1} comensales en mesa`}
                    </span>
                  </div>

                  {!isAvailable && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
                        <Clock size={16} />
                        <span>Abierta: {new Date(table.active_session?.opened_at || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>Total comanda:</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text-primary)" }}>{formatCOP(tableTotal)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ paddingTop: 10, borderTop: "1px solid var(--color-border)", display: "flex", gap: 8 }}>
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
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setPosTable(table);
                        setCartLines([]);
                        setSelectedCat(null);
                        setPosSearchTerm("");
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      title="Agregar comanda / productos"
                    >
                      <UtensilsCrossed size={16} />
                      <span>Pedir</span>
                    </button>
                    <button
                      onClick={() => setDetailTable(table)}
                      className="btn btn-secondary btn-sm"
                      title="Ver comanda y cuenta"
                    >
                      <FileText size={16} />
                    </button>
                    {isPendingPay && (
                      <button
                        onClick={() => navigate(`/cash?table_id=${table.id}`)}
                        className="btn btn-sm"
                        style={{ backgroundColor: "var(--color-tertiary)", color: "#ffffff" }}
                        title="Cobrar en caja"
                      >
                        <CreditCard size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ABRIR MESA */}
      {openTableModal && (
        <div className="modal-backdrop" onClick={() => setOpenTableModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Abrir Mesa {openTableModal.number}</h3>
              <button onClick={() => setOpenTableModal(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleOpenTable}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Número de comensales</label>
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
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setOpenTableModal(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POS TOMA DE PEDIDO (Stitch toma_de_pedido_potoquitos) */}
      {posTable && (
        <div className="modal-backdrop" onClick={() => setPosTable(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 1040, maxHeight: "92vh" }}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800 }}>
                  Toma de Pedido — Mesa {posTable.number}
                </h3>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Selecciona los platos y bebidas para enviar la orden a cocina.
                </span>
              </div>
              <button onClick={() => setPosTable(null)} className="btn-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.3fr", height: "70vh", overflow: "hidden" }}>
              {/* LEFT: PRODUCTS LIST & CATEGORY PILLS */}
              <div style={{ padding: 18, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Category Pills */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, flexShrink: 0 }}>
                  <button
                    onClick={() => setSelectedCat(null)}
                    className={`badge ${selectedCat === null ? "badge-info" : "badge-neutral"}`}
                    style={{ cursor: "pointer", height: 32, padding: "0 12px" }}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCat(cat.id)}
                      className={`badge ${selectedCat === cat.id ? "badge-info" : "badge-neutral"}`}
                      style={{ cursor: "pointer", height: 32, padding: "0 12px" }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Product Search Bar */}
                <div style={{ position: "relative", marginBottom: 8, flexShrink: 0 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Buscar plato o bebida..."
                    value={posSearchTerm}
                    onChange={(e) => setPosSearchTerm(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: 32, height: 32, fontSize: 12 }}
                  />
                </div>

                {/* Product Cards Grid */}
                <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, paddingTop: 4 }}>
                  {products
                    .filter((p) => {
                      if (selectedCat !== null && p.category_id !== selectedCat) return false;
                      if (posSearchTerm.trim() && !p.name.toLowerCase().includes(posSearchTerm.toLowerCase())) return false;
                      return true;
                    })
                    .map((product) => (
                      <div
                        key={product.id}
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderRadius: "var(--radius-md)",
                          padding: 12,
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {mediaUrl(product.image_reference) ? (
                            <img
                              src={mediaUrl(product.image_reference)!}
                              alt={product.name}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                objectFit: "cover",
                                flexShrink: 0,
                                backgroundColor: "var(--color-surface-secondary)",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                backgroundColor: "var(--color-surface-secondary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                color: "var(--color-text-muted)",
                              }}
                            >
                              <UtensilsCrossed size={18} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {product.name}
                            </h4>
                            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {product.description}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 800 }}>{formatCOP(product.current_price)}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="btn btn-primary btn-sm"
                            style={{ height: 30, padding: "0 10px" }}
                          >
                            <Plus size={14} />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* RIGHT: LIVE COMANDA (Stitch Sticky Comanda) */}
              <div style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "var(--color-surface-secondary)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700 }}>Comanda Actual</h4>
                    <span className="badge badge-warning">Borrador</span>
                  </div>

                  {cartLines.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
                      <UtensilsCrossed size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                      <p style={{ fontSize: 13 }}>No has agregado productos a esta comanda.</p>
                      <span style={{ fontSize: 11 }}>Selecciona platos del menú a la izquierda.</span>
                    </div>
                  ) : (
                    <div style={{ maxHeight: "40vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                      {cartLines.map((line) => (
                        <div
                          key={line.product_id}
                          style={{
                            backgroundColor: "var(--color-surface)",
                            borderRadius: "var(--radius-md)",
                            padding: 10,
                            border: "1px solid var(--color-border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{line.product_name}</span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{formatCOP(line.quantity * Number(line.unit_price))}</span>
                          </div>

                          {/* Controls & Delete */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => updateQuantity(line.product_id, -1)}
                                className="btn btn-secondary btn-sm"
                                style={{ width: 28, height: 28, padding: 0 }}
                              >
                                <Minus size={14} />
                              </button>
                              <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{line.quantity}</span>
                              <button
                                onClick={() => updateQuantity(line.product_id, 1)}
                                className="btn btn-secondary btn-sm"
                                style={{ width: 28, height: 28, padding: 0 }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              onClick={() => updateQuantity(line.product_id, -line.quantity)}
                              className="btn-icon"
                              style={{ width: 28, height: 28, color: "var(--color-secondary)" }}
                              title="Quitar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Kitchen observation note */}
                          <input
                            type="text"
                            placeholder="Nota de cocina (ej. sin cebolla, tocineta extra)"
                            value={line.notes || ""}
                            onChange={(e) => updateLineNote(line.product_id, e.target.value)}
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--color-border)",
                              backgroundColor: "var(--color-surface-secondary)",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtotal & Action */}
                <div style={{ paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)" }}>Total comanda:</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)" }}>{formatCOP(cartSubtotal)}</span>
                  </div>
                  <button
                    onClick={handleSendOrder}
                    disabled={cartLines.length === 0}
                    className="btn btn-primary"
                    style={{ width: "100%", height: 44 }}
                  >
                    <Send size={18} />
                    <span>Confirmar y Enviar a Cocina</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE MESA & CUENTA */}
      {detailTable && (
        <div className="modal-backdrop" onClick={() => setDetailTable(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Detalle de Mesa {detailTable.number}</h3>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {detailTable.active_session?.people_count || 1} comensales
                </span>
              </div>
              <button onClick={() => setDetailTable(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Consumo acumulado</h4>
              {tableOrders(detailTable.active_session?.id).length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No hay comandas registradas en esta mesa.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tableOrders(detailTable.active_session?.id).map((ord) => (
                    <div key={ord.id} style={{ padding: 10, borderRadius: 8, backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>Comanda #{ord.id}</span>
                        <span className="badge badge-neutral" style={{ height: 20, fontSize: 10 }}>{ord.state}</span>
                      </div>
                      {ord.lines.map((l, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)" }}>
                          <span>{l.quantity} × {l.product_name}</span>
                          <span>{formatCOP(l.quantity * Number(l.unit_price))}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button
                onClick={() => handleRequestAccount(detailTable.id)}
                className="btn btn-secondary btn-sm"
              >
                <FileText size={16} />
                <span>Pedir cuenta</span>
              </button>

              <button
                onClick={() => {
                  const tid = detailTable.id;
                  setDetailTable(null);
                  navigate(`/cash?table_id=${tid}`);
                }}
                className="btn btn-primary btn-sm"
              >
                <CreditCard size={16} />
                <span>Ir al Cobro / POS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER LATERAL: CREAR / EDITAR MESA (Stitch slide-over) */}
      <Drawer
        isOpen={tableDrawerOpen}
        onClose={() => setTableDrawerOpen(false)}
        title={editingTable ? `Editar ${editingTable.number}` : "Nueva Mesa"}
        subtitle="Configura la identificación, capacidad y estado de la mesa en salón"
        width="md"
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
    </div>
  );
}
