import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, downloadAuthenticatedBlob } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

import {
  CreditCard,
  DollarSign,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  FileText,
  Download,
  Printer,
  X,
  AlertCircle,
  Armchair,
  Receipt,
  ArrowRight,
} from "lucide-react";

type CashRegister = {
  id: number;
  name: string;
  is_active: boolean;
  active_session: {
    id: number;
    cashier_id: number;
    initial_cash: number;
    opened_at: string;
  } | null;
};

type Table = {
  id: number;
  number: string;
  state: string;
  active_session: {
    id: number;
    people_count: number;
  } | null;
};

type Order = {
  id: number;
  table_session_id: number;
  state: string;
  lines: {
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

type Invoice = {
  id: number;
  invoice_number: string;
  subtotal: number;
  tip: number;
  total: number;
  payment_method: string;
  created_at: string;
  table_number?: string;
  waiter_name?: string;
  cash_received?: number;
  change?: number;
  lines?: {
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

export function CashPage() {
  const { accessToken, user } = useAuth();
  const token = accessToken!;

  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Open Register Modal
  const [openRegisterModal, setOpenRegisterModal] = useState<CashRegister | null>(null);
  const [initialCash, setInitialCash] = useState(100000);

  // Close Register Modal
  const [closeRegisterModal, setCloseRegisterModal] = useState<CashRegister | null>(null);
  const [countedCash, setCountedCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState("");

  // POS Checkout State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [includeTip, setIncludeTip] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [cashReceived, setCashReceived] = useState<number>(0);
  const [paying, setPaying] = useState(false);

  // Success Invoice Screen
  const [confirmedInvoice, setConfirmedInvoice] = useState<Invoice | null>(null);

  const [searchParams] = useSearchParams();
  const queryTableId = searchParams.get("table_id");

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val));

  async function loadData() {
    try {
      setLoading(true);
      const [rRes, tRes, oRes] = await Promise.all([
        apiRequest<any>("/cash/registers", {}, token).catch(() => []),
        apiRequest<any>("/tables-orders/tables", {}, token).catch(() => []),
        apiRequest<any>("/tables-orders/orders", {}, token).catch(() => []),
      ]);
      const rList = Array.isArray(rRes) ? rRes : (rRes?.items || []);
      const tList = Array.isArray(tRes) ? tRes : (tRes?.items || []);
      const oList = Array.isArray(oRes) ? oRes : (oRes?.items || []);

      setRegisters(rList);
      setTables(tList);
      setOrders(oList);

      if (queryTableId) {
        const found = tList.find((t: any) => String(t.id) === String(queryTableId));
        if (found) setSelectedTable(found);
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token, queryTableId]);

  // Open Register Action
  async function handleOpenRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!openRegisterModal) return;
    try {
      await apiRequest(
        `/cash/registers/${openRegisterModal.id}/open`,
        {
          method: "POST",
          body: JSON.stringify({ initial_cash: initialCash }),
        },
        token
      );
      setOpenRegisterModal(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Close Register Action
  async function handleCloseRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!closeRegisterModal || !closeRegisterModal.active_session) return;
    try {
      await apiRequest(
        `/cash/sessions/${closeRegisterModal.active_session.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            counted_cash: countedCash,
            notes: closeNotes,
          }),
        },
        token
      );
      setCloseRegisterModal(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Checkout calculation
  const tableOrders = selectedTable
    ? orders.filter((o) => o.table_session_id === selectedTable.active_session?.id)
    : [];

  const subtotal = tableOrders.reduce(
    (sum, o) =>
      sum +
      o.lines.reduce(
        (lSum, l) => lSum + l.quantity * Number(l.unit_price),
        0
      ),
    0
  );

  const tip = includeTip ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + tip;
  const change = Math.max(0, cashReceived - total);

  // Process Payment
  async function handleConfirmPayment() {
    if (!selectedTable || !selectedTable.active_session) return;
    const activeRegister = registers.find((r) => r.active_session !== null);
    if (!activeRegister || !activeRegister.active_session) {
      setMessage("Debes tener una caja abierta para procesar cobros.");
      return;
    }

    try {
      setPaying(true);
      const res = await apiRequest<any>(
        "/cash/payments",
        {
          method: "POST",
          body: JSON.stringify({
            table_session_id: selectedTable.active_session.id,
            cash_session_id: activeRegister.active_session.id,
            tip_amount: tip,
            details: [
              {
                payment_method: paymentMethod,
                amount: total,
              },
            ],
            payments: [
              {
                method: paymentMethod,
                amount: total,
              },
            ],
            cash_received: paymentMethod === "EFECTIVO" ? (cashReceived || total) : total,
          }),
        },
        token
      );

      const tableOrders = orders.filter((o) => o.table_session_id === selectedTable.active_session?.id);
      const allLines = tableOrders.flatMap((o) => o.lines || []);

      const now = new Date();
      const formattedDate = `${now.toLocaleDateString("es-CO")} ${now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;

      setConfirmedInvoice({
        id: res.invoice_id || res.invoice?.id || res.id || 1,
        invoice_number: res.invoice_number || res.invoice?.number || "FAC-0001",
        subtotal,
        tip,
        total,
        payment_method: paymentMethod,
        created_at: formattedDate,
        table_number: selectedTable.number,
        waiter_name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Servicio",
        cash_received: paymentMethod === "EFECTIVO" ? (cashReceived || total) : total,
        change: paymentMethod === "EFECTIVO" ? Math.max(0, (cashReceived || total) - total) : 0,
        lines: allLines.map((l) => ({
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: Number(l.unit_price),
        })),
      });

      setSelectedTable(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  const activeRegister = registers.find((r) => r.active_session !== null);
  const pendingTables = tables.filter((t) => t.state !== "DISPONIBLE");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Cajas y Cobro de Mesa / POS
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Control de terminales físicas, arqueos y cobro presencial en restaurante.
          </p>
        </div>

        {/* Active Register Chip */}
        {activeRegister ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge badge-success">
              <span className="badge-dot" /> Caja abierta: {activeRegister.name}
            </span>
            <button
              onClick={() => {
                setCloseRegisterModal(activeRegister);
                setCountedCash(activeRegister.active_session?.initial_cash || 0);
              }}
              className="btn btn-secondary btn-sm"
            >
              <Lock size={15} />
              <span>Cerrar turno</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              if (registers.length > 0) {
                setOpenRegisterModal(registers[0]);
                setInitialCash(100000);
              }
            }}
            className="btn btn-primary btn-sm"
          >
            <Unlock size={15} />
            <span>Abrir caja de turno</span>
          </button>
        )}
      </div>

      {message && (
        <div className="alert-box alert-danger" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")}><X size={16} /></button>
        </div>
      )}

      {/* CONFIRMED INVOICE SCREEN (Stitch pago_confirmado_factura_pdf_potoquitos) */}
      {confirmedInvoice ? (
        <div className="card" style={{ maxWidth: 680, margin: "0 auto", padding: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: "var(--color-tertiary-soft)",
                color: "var(--color-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>¡Pago Exitoso y Factura Emitida!</h2>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 4 }}>
              Mesa {confirmedInvoice.table_number} ha sido liberada y está disponible para comensales.
            </p>
          </div>

          <div style={{ backgroundColor: "var(--color-surface-secondary)", borderRadius: "var(--radius-md)", padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Número de Factura:</span>
              <strong style={{ fontSize: 14, fontFamily: "monospace" }}>{confirmedInvoice.invoice_number}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Mesa:</span>
              <span style={{ fontWeight: 600 }}>{confirmedInvoice.table_number}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Fecha y Hora:</span>
              <span>{confirmedInvoice.created_at}</span>
            </div>

            {/* Consumo detallado */}
            {confirmedInvoice.lines && confirmedInvoice.lines.length > 0 && (
              <div style={{ margin: "14px 0", borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)", padding: "10px 0" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.05em" }}>
                  Detalle de Consumo
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {confirmedInvoice.lines.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{item.quantity}x {item.product_name}</span>
                      <span style={{ fontWeight: 500 }}>{formatCOP(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Subtotal:</span>
              <span>{formatCOP(confirmedInvoice.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Propina voluntaria (10%):</span>
              <span>{formatCOP(confirmedInvoice.tip)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Total Pagado:</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text-primary)" }}>
                {formatCOP(confirmedInvoice.total)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)" }}>
              <span>Método: <strong>{confirmedInvoice.payment_method}</strong></span>
              {confirmedInvoice.payment_method === "EFECTIVO" && (
                <span>Recibido: {formatCOP(confirmedInvoice.cash_received || confirmedInvoice.total)} · Cambio: {formatCOP(confirmedInvoice.change || 0)}</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-primary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, fontSize: 15 }}
              id="btn-print-invoice"
            >
              <Printer size={18} />
              <span>🖨 Imprimir</span>
            </button>

            <button
              onClick={() => setConfirmedInvoice(null)}
              className="btn btn-secondary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44 }}
            >
              <span>Cobrar otra mesa</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* POS WORKSPACE: SELECT TABLE & PAY */
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 24, alignItems: "flex-start" }}>
          {/* LEFT: PENDING TABLES CAROUSEL/LIST */}
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Mesas Pendientes de Cobro ({pendingTables.length})
            </h3>
            {pendingTables.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--color-text-muted)" }}>
                <Armchair size={36} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>No hay mesas activas para cobrar.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingTables.map((tbl) => {
                  const isSelected = selectedTable?.id === tbl.id;
                  const tOrders = orders.filter((o) => o.table_session_id === tbl.active_session?.id);
                  const tTotal = tOrders.reduce(
                    (acc, o) =>
                      acc +
                      o.lines.reduce(
                        (lSum, l) => lSum + l.quantity * Number(l.unit_price),
                        0
                      ),
                    0
                  );

                  return (
                    <div
                      key={tbl.id}
                      onClick={() => {
                        setSelectedTable(tbl);
                        setCashReceived(tTotal + Math.round(tTotal * 0.1));
                      }}
                      style={{
                        padding: 12,
                        borderRadius: "var(--radius-md)",
                        backgroundColor: isSelected ? "var(--color-primary-soft)" : "var(--color-surface-secondary)",
                        border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            backgroundColor: isSelected ? "var(--color-primary)" : "var(--color-surface)",
                            color: isSelected ? "#ffffff" : "var(--color-text-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          {tbl.number}
                        </div>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Mesa {tbl.number}</h4>
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {tbl.state === "PENDIENTE_PAGO" ? "Cuenta solicitada" : "En consumo"}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{formatCOP(tTotal)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: POS CHECKOUT PANEL (Stitch cobro_de_mesa_pos_potoquitos) */}
          <div className="card" style={{ padding: 22 }}>
            {!selectedTable ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
                <Receipt size={44} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  Ninguna mesa seleccionada
                </h4>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  Haz clic en una mesa pendiente a la izquierda para liquidar la cuenta.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--color-border)" }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800 }}>Cobro — Mesa {selectedTable.number}</h3>
                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {selectedTable.active_session?.people_count || 1} personas
                    </span>
                  </div>
                  <button onClick={() => setSelectedTable(null)} className="btn-icon">
                    <X size={18} />
                  </button>
                </div>

                {/* Items consumed list */}
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {tableOrders.flatMap((o) => o.lines).map((l, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "4px 0",
                        borderBottom: "1px dashed var(--color-surface-container)",
                      }}
                    >
                      <span>{l.quantity} × {l.product_name}</span>
                      <span style={{ fontWeight: 600 }}>{formatCOP(l.quantity * Number(l.unit_price))}</span>
                    </div>
                  ))}
                </div>

                {/* Totals Breakdown */}
                <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 14, borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>Subtotal consumo:</span>
                    <span style={{ fontWeight: 600 }}>{formatCOP(subtotal)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={includeTip}
                        onChange={(e) => setIncludeTip(e.target.checked)}
                      />
                      <span>Propina voluntaria sugerida (10%)</span>
                    </label>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{formatCOP(tip)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>Total a cobrar:</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--color-primary)" }}>{formatCOP(total)}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="form-label">Método de pago presencial</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 }}>
                    {["EFECTIVO", "TARJETA", "TRANSFERENCIA", "NEQUI", "DAVIPLATA", "OTRO"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`btn btn-sm ${paymentMethod === m ? "btn-primary" : "btn-secondary"}`}
                        style={{ height: 36, fontSize: 12 }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash Received and Change (if Cash) */}
                {paymentMethod === "EFECTIVO" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Efectivo recibido (COP)</label>
                      <input
                        type="number"
                        step="1000"
                        value={cashReceived || ""}
                        onChange={(e) => setCashReceived(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Cambio / Vueltos</label>
                      <div
                        style={{
                          height: 42,
                          backgroundColor: "var(--color-surface-secondary)",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 14px",
                          fontWeight: 800,
                          fontSize: 16,
                          color: change >= 0 ? "var(--color-tertiary)" : "var(--color-secondary)",
                        }}
                      >
                        {formatCOP(change)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Payment Button */}
                <button
                  onClick={handleConfirmPayment}
                  disabled={paying || subtotal === 0}
                  className="btn btn-primary"
                  style={{ height: 46, fontSize: 15, width: "100%", marginTop: 6 }}
                >
                  <CreditCard size={18} />
                  <span>{paying ? "Procesando pago..." : "Confirmar cobro y emitir factura"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ABRIR CAJA */}
      {openRegisterModal && (
        <div className="modal-backdrop" onClick={() => setOpenRegisterModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Abrir {openRegisterModal.name}</h3>
              <button onClick={() => setOpenRegisterModal(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleOpenRegister}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Base en efectivo inicial (COP)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={initialCash}
                    onChange={(e) => setInitialCash(Number(e.target.value))}
                    className="form-input"
                    required
                  />
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    Monto con el que se inicia el turno en la gaveta física.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setOpenRegisterModal(null)} className="btn btn-secondary">
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

      {/* MODAL: CIERRE DE CAJA / ARQUEO (Stitch cierre_de_caja_potoquitos) */}
      {closeRegisterModal && (
        <div className="modal-backdrop" onClick={() => setCloseRegisterModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Arqueo y Cierre de Turno</h3>
              <button onClick={() => setCloseRegisterModal(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCloseRegister}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Efectivo contado en gaveta (COP)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={countedCash}
                    onChange={(e) => setCountedCash(Number(e.target.value))}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Observaciones de cierre</label>
                  <textarea
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Detalles de arqueo, entrega de turno o novedades..."
                    className="form-textarea"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setCloseRegisterModal(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirmar Cierre de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECCIÓN IMPRIMIBLE EXCLUSIVA PARA TICKET / FACTURA (@media print) */}
      {confirmedInvoice && (
        <div className="potoquitos-receipt-print-area">
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.05em" }}>POTOQUITOS</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>RESTAURANTE & COMIDAS RÁPIDAS</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>NIT: 901.458.789-2 · Régimen Simple</div>
            <div style={{ fontSize: 10 }}>Calle 45 # 28 - 14, Barranquilla</div>
            <div style={{ fontSize: 10 }}>Tel: +57 300 123 4567</div>
          </div>

          <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", margin: "6px 0", fontSize: 11 }}>
            <div>FACTURA DE VENTA: <strong>{confirmedInvoice.invoice_number}</strong></div>
            <div>FECHA Y HORA: {confirmedInvoice.created_at}</div>
            <div>MESA: <strong>{confirmedInvoice.table_number}</strong></div>
            <div>ATENDIDO POR: {confirmedInvoice.waiter_name || user?.first_name || "Servicio"}</div>
          </div>

          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", margin: "6px 0" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", width: "15%", padding: "2px 0" }}>Cant</th>
                <th style={{ textAlign: "left", width: "55%", padding: "2px 0" }}>Producto</th>
                <th style={{ textAlign: "right", width: "30%", padding: "2px 0" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {confirmedInvoice.lines && confirmedInvoice.lines.length > 0 ? (
                confirmedInvoice.lines.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ verticalAlign: "top", padding: "2px 0" }}>{item.quantity}</td>
                    <td style={{ verticalAlign: "top", padding: "2px 0" }}>{item.product_name}</td>
                    <td style={{ textAlign: "right", verticalAlign: "top", padding: "2px 0" }}>{formatCOP(item.quantity * item.unit_price)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>1</td>
                  <td>Consumo de mesa</td>
                  <td style={{ textAlign: "right" }}>{formatCOP(confirmedInvoice.subtotal)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", paddingTop: 4, marginTop: 4, fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>SUBTOTAL:</span>
              <span>{formatCOP(confirmedInvoice.subtotal)}</span>
            </div>
            {confirmedInvoice.tip > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PROPINA (10%):</span>
                <span>{formatCOP(confirmedInvoice.tip)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13, marginTop: 4, borderTop: "1px solid #000", paddingTop: 4 }}>
              <span>TOTAL:</span>
              <span>{formatCOP(confirmedInvoice.total)}</span>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", paddingTop: 4, marginTop: 6, fontSize: 10 }}>
            <div>FORMA DE PAGO: <strong>{confirmedInvoice.payment_method}</strong></div>
            {confirmedInvoice.payment_method === "EFECTIVO" && (
              <>
                <div>VALOR RECIBIDO: {formatCOP(confirmedInvoice.cash_received || confirmedInvoice.total)}</div>
                <div>CAMBIO: {formatCOP(confirmedInvoice.change || 0)}</div>
              </>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 12, fontSize: 10 }}>
            <div>*** GRACIAS POR SU VISITA ***</div>
            <div>POTOQUITOS SOFTWARE V1.0</div>
          </div>
        </div>
      )}
    </div>
  );
}
