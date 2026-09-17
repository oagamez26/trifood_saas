import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, downloadAuthenticatedBlob } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Drawer } from "../../components/Drawer";
import { IconButton } from "../../components/IconButton";

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
  Search,
  History,
  Coins,
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
  is_active?: boolean;
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
  remaining_balance?: number;
  table_state?: string;
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

  // Closed Session Report Modal & Download
  const [closedSessionReport, setClosedSessionReport] = useState<any | null>(null);
  const [downloadingReportPdf, setDownloadingReportPdf] = useState(false);

  // POS Checkout State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableSummary, setTableSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [cashStatusFilter, setCashStatusFilter] = useState<"ALL" | "CUENTA_SOLICITADA" | "PAGO_PARCIAL">("ALL");

  const [paymentMode, setPaymentMode] = useState<"FULL" | "ITEMS" | "ABONO">("FULL");
  const [abonoAmount, setAbonoAmount] = useState<number | "">("");
  const [itemQuantitiesToPay, setItemQuantitiesToPay] = useState<Record<number, number>>({});

  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TARJETA" | "TRANSFERENCIA">("EFECTIVO");
  const [includeTip, setIncludeTip] = useState(true);
  const [customTip, setCustomTip] = useState<number | "">("");

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

  async function selectPendingTable(tbl: Table) {
    setSelectedTable(tbl);
    setPaymentMode("FULL");
    setItemQuantitiesToPay({});
    setAbonoAmount("");
    setCustomTip("");
    try {
      setLoadingSummary(true);
      const summary = await apiRequest<any>(`/cash/tables/${tbl.id}/summary`, {}, token);
      setTableSummary(summary);
      const initQ: Record<number, number> = {};
      if (summary.items) {
        for (const it of summary.items) {
          initQ[it.order_line_id] = it.pending_qty;
        }
      }
      setItemQuantitiesToPay(initQ);
      const balance = Number(summary.pending_balance || 0);
      setCashReceived(balance + Math.round(balance * 0.1));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoadingSummary(false);
    }
  }

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
        if (found) void selectPendingTable(found);
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
      const res = await apiRequest<any>(
        `/cash/sessions/${closeRegisterModal.active_session.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            reported_cash: countedCash,
            notes: closeNotes,
          }),
        },
        token
      );
      setCloseRegisterModal(null);
      setClosedSessionReport(res);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleDownloadClosePdf(sessionId: number) {
    try {
      setDownloadingReportPdf(true);
      await downloadAuthenticatedBlob(
        `/cash/sessions/${sessionId}/report/pdf`,
        `cierre_caja_${sessionId}.pdf`,
        token
      );
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setDownloadingReportPdf(false);
    }
  }

  // Checkout calculation
  const pendingBalance = Number(tableSummary?.pending_balance || 0);

  const consumptionToPay =
    paymentMode === "FULL"
      ? pendingBalance
      : paymentMode === "ABONO"
      ? Number(abonoAmount || 0)
      : Object.entries(itemQuantitiesToPay).reduce((sum, [lineId, q]) => {
          const it = tableSummary?.items?.find(
            (i: any) => String(i.order_line_id) === String(lineId)
          );
          return sum + (it ? Number(it.unit_price) * Number(q) : 0);
        }, 0);

  const tip =
    typeof customTip === "number"
      ? customTip
      : includeTip
      ? Math.round(consumptionToPay * 0.1)
      : 0;

  const total = consumptionToPay + tip;
  const change =
    paymentMethod === "EFECTIVO" ? Math.max(0, cashReceived - total) : 0;

  // Process Payment
  async function handleConfirmPayment() {
    if (!selectedTable || !selectedTable.active_session || !tableSummary) return;
    const activeRegister = registers.find((r) => r.active_session !== null);
    if (!activeRegister || !activeRegister.active_session) {
      setMessage("Debes tener una caja abierta para procesar cobros.");
      return;
    }
    if (consumptionToPay <= 0) {
      setMessage("El valor de consumo a liquidar debe ser superior a cero.");
      return;
    }
    if (paymentMode === "ABONO") {
      const val = Number(abonoAmount);
      if (!val || val <= 0) {
        setMessage("Por favor ingresa un monto de abono válido mayor a $0.");
        return;
      }
      if (val > pendingBalance) {
        setMessage(`El abono (${formatCOP(val)}) no puede superar el saldo pendiente (${formatCOP(pendingBalance)}).`);
        return;
      }
    }

    try {
      setPaying(true);
      const payload: any = {
        table_session_id: tableSummary.session_id,
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
      };

      if (paymentMode === "ABONO") {
        payload.custom_amount = Number(abonoAmount);
      } else if (paymentMode === "ITEMS") {
        payload.items = Object.entries(itemQuantitiesToPay)
          .filter(([_, q]) => Number(q) > 0)
          .map(([lineId, q]) => ({
            order_line_id: Number(lineId),
            quantity: Number(q),
          }));
      }

      const res = await apiRequest<any>(
        "/cash/payments",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        token
      );

      const now = new Date();
      const formattedDate = `${now.toLocaleDateString("es-CO")} ${now.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      const coveredLines =
        paymentMode === "ABONO"
          ? [
              {
                product_name: `Abono parcial a cuenta — Mesa ${selectedTable.number}`,
                quantity: 1,
                unit_price: Number(abonoAmount),
              },
            ]
          : paymentMode === "ITEMS"
          ? (tableSummary.items || [])
              .filter((it: any) => (itemQuantitiesToPay[it.order_line_id] || 0) > 0)
              .map((it: any) => ({
                product_name: it.name,
                quantity: itemQuantitiesToPay[it.order_line_id],
                unit_price: Number(it.unit_price),
              }))
          : (tableSummary.items || [])
              .filter((it: any) => it.pending_qty > 0)
              .map((it: any) => ({
                product_name: it.name,
                quantity: it.pending_qty,
                unit_price: Number(it.unit_price),
              }));

      setConfirmedInvoice({
        id: res.invoice_id || res.id || 1,
        invoice_number: res.invoice_number || "FAC-0001",
        subtotal: Number(res.consumption_amount || consumptionToPay),
        tip: Number(res.tip_amount || tip),
        total: Number(res.total_amount || total),
        payment_method: paymentMethod,
        created_at: formattedDate,
        table_number: selectedTable.number,
        waiter_name: tableSummary.waiter_name || user?.first_name || "Servicio",
        cash_received: paymentMethod === "EFECTIVO" ? (cashReceived || total) : total,
        change: Number(res.change ?? change),
        remaining_balance: Number(res.remaining_balance || 0),
        table_state: res.table_state,
        lines: coveredLines,
      });

      setSelectedTable(null);
      setTableSummary(null);
      await loadData();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  const activeRegister = registers.find((r) => r.active_session !== null);
  const eligibleTables = tables.filter((t) => {
    if (t.is_active === false) return false;
    return t.state === "CUENTA_SOLICITADA" || t.state === "PENDIENTE_PAGO" || t.state === "PAGO_PARCIAL";
  });

  const pendingTables = eligibleTables.filter((t) => {
    if (cashStatusFilter === "CUENTA_SOLICITADA" && t.state === "PAGO_PARCIAL") return false;
    if (cashStatusFilter === "PAGO_PARCIAL" && t.state !== "PAGO_PARCIAL") return false;
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      const numStr = t.number.toLowerCase();
      const numMatch = numStr.includes(q);
      const fullMatch = `mesa ${numStr}`.includes(q);
      const strippedQ = q.replace(/^mesa\s*/i, "").replace(/^m-?/i, "").trim();
      const strippedMatch = strippedQ ? numStr.includes(strippedQ) : false;
      const idMatch = String(t.id) === q || String(t.id) === strippedQ;
      return numMatch || fullMatch || strippedMatch || idMatch;
    }
    return true;
  });

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
              <span>Imprimir</span>
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
              Mesas Pendientes de Cobro ({eligibleTables.length})
            </h3>

            {/* Search filter */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar mesa..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 34, height: 36, fontSize: 13 }}
              />
            </div>

            {/* Status pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
              <button
                type="button"
                onClick={() => setCashStatusFilter("ALL")}
                className={`btn btn-sm ${cashStatusFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                Todas ({eligibleTables.length})
              </button>
              <button
                type="button"
                onClick={() => setCashStatusFilter("CUENTA_SOLICITADA")}
                className={`btn btn-sm ${cashStatusFilter === "CUENTA_SOLICITADA" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                Cuenta solicitada ({eligibleTables.filter((t) => t.state !== "PAGO_PARCIAL").length})
              </button>
              <button
                type="button"
                onClick={() => setCashStatusFilter("PAGO_PARCIAL")}
                className={`btn btn-sm ${cashStatusFilter === "PAGO_PARCIAL" ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                Pago parcial ({eligibleTables.filter((t) => t.state === "PAGO_PARCIAL").length})
              </button>
            </div>

            {pendingTables.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)" }}>
                <Armchair size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <p style={{ fontSize: 12 }}>
                  {eligibleTables.length === 0
                    ? "No hay mesas pendientes de cobro en este momento."
                    : "No se encontraron mesas con ese filtro."}
                </p>
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
                      onClick={() => void selectPendingTable(tbl)}
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
                            {tbl.state === "PAGO_PARCIAL" ? "Pago parcial" : "Cuenta solicitada"}
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

                {loadingSummary ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                    Cargando resumen de cuenta...
                  </div>
                ) : (
                  <>
                    {/* Summary KPI Strip: Total Cuenta | Total Pagado | Saldo Pendiente */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    backgroundColor: "var(--color-surface-secondary)",
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Total Cuenta</span>
                    <strong style={{ fontSize: 14, color: "var(--color-text-primary)" }}>{formatCOP(tableSummary?.total_amount || 0)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Total Pagado</span>
                    <strong style={{ fontSize: 14, color: "var(--color-tertiary)" }}>{formatCOP(tableSummary?.total_paid || 0)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block" }}>Saldo Pendiente</span>
                    <strong style={{ fontSize: 16, color: "var(--color-primary)", fontWeight: 800 }}>{formatCOP(tableSummary?.pending_balance || 0)}</strong>
                  </div>
                </div>

                {/* Historial de Pagos Previos de la Mesa */}
                {tableSummary?.payments_history && tableSummary.payments_history.length > 0 && (
                  <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <History size={14} color="var(--color-primary)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>Historial de pagos de esta mesa</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 110, overflowY: "auto" }}>
                      {tableSummary.payments_history.map((p: any) => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 8px", backgroundColor: "var(--color-surface-secondary)", borderRadius: "var(--radius-sm)" }}>
                          <span>
                            <strong>Pago #{p.number}</strong> — <span style={{ color: "var(--color-text-secondary)" }}>{p.payment_method}</span> — {p.time || p.created_at?.slice(11, 16)}
                          </span>
                          <span style={{ fontWeight: 700, color: "var(--color-tertiary)" }}>
                            {formatCOP(p.consumption_amount || p.total_amount)}
                            {Number(p.tip_amount) > 0 && <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 4 }}>+propina</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selector de Modalidad de Cobro */}
                <div>
                  <label className="form-label" style={{ marginBottom: 6 }}>Modalidad de cobro</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("FULL")}
                      className={`btn btn-sm ${paymentMode === "FULL" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, height: 34 }}
                    >
                      Saldo total
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("ITEMS")}
                      className={`btn btn-sm ${paymentMode === "ITEMS" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, height: 34 }}
                    >
                      Por productos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode("ABONO");
                        if (!abonoAmount && pendingBalance > 0) {
                          setAbonoAmount(Math.min(50000, pendingBalance));
                        }
                      }}
                      className={`btn btn-sm ${paymentMode === "ABONO" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, height: 34 }}
                    >
                      Abono libre
                    </button>
                  </div>
                </div>

                {/* VISTA SEGÚN MODALIDAD: ABONO LIBRE */}
                {paymentMode === "ABONO" && (
                  <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Valor a abonar (COP)</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number"
                        step="1000"
                        min="1000"
                        max={pendingBalance}
                        value={abonoAmount}
                        onChange={(e) => setAbonoAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="Ej: 20000, 35000..."
                        className="form-input"
                        style={{ fontSize: 16, fontWeight: 800, flex: 1 }}
                      />
                    </div>
                    {/* Botones rápidos de abono */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {[10000, 20000, 50000].filter((v) => v < pendingBalance).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAbonoAmount(val)}
                          className="btn btn-secondary btn-sm"
                          style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                        >
                          +{formatCOP(val)}
                        </button>
                      ))}
                      {pendingBalance > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAbonoAmount(Math.round(pendingBalance / 2))}
                            className="btn btn-secondary btn-sm"
                            style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                          >
                            50% ({formatCOP(Math.round(pendingBalance / 2))})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAbonoAmount(pendingBalance)}
                            className="btn btn-secondary btn-sm"
                            style={{ height: 26, fontSize: 11, padding: "0 8px" }}
                          >
                            Todo ({formatCOP(pendingBalance)})
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* VISTA SEGÚN MODALIDAD: POR PRODUCTOS */}
                {paymentMode === "ITEMS" && (
                  <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {(tableSummary?.items || []).filter((it: any) => it.pending_qty > 0).map((it: any) => {
                      const currentQ = itemQuantitiesToPay[it.order_line_id] || 0;
                      return (
                        <div
                          key={it.order_line_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            backgroundColor: "var(--color-surface-secondary)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{it.name}</div>
                            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                              {formatCOP(it.unit_price)} c/u — Pendiente: {it.pending_qty}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setItemQuantitiesToPay((prev) => ({ ...prev, [it.order_line_id]: Math.max(0, (prev[it.order_line_id] || 0) - 1) }))}
                              className="btn btn-secondary btn-sm"
                              style={{ width: 28, height: 28, padding: 0 }}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: 800, width: 20, textAlign: "center" }}>{currentQ}</span>
                            <button
                              type="button"
                              onClick={() => setItemQuantitiesToPay((prev) => ({ ...prev, [it.order_line_id]: Math.min(it.pending_qty, (prev[it.order_line_id] || 0) + 1) }))}
                              className="btn btn-secondary btn-sm"
                              style={{ width: 28, height: 28, padding: 0 }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* VISTA SEGÚN MODALIDAD: SALDO TOTAL (LISTADO DE ÍTEMS CONSUMIDOS) */}
                {paymentMode === "FULL" && (
                  <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {(tableSummary?.items || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "8px 0" }}>Sin ítems pendientes de pago.</p>
                    ) : (
                      (tableSummary?.items || []).map((it: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 13,
                            padding: "4px 0",
                            borderBottom: "1px dashed var(--color-surface-container)",
                            opacity: it.pending_qty === 0 ? 0.4 : 1,
                          }}
                        >
                          <span>
                            {it.pending_qty}×{it.ordered_qty > it.pending_qty ? `/${it.ordered_qty}` : ""} {it.name}
                            {it.paid_qty > 0 && <span style={{ fontSize: 10, color: "var(--color-tertiary)", marginLeft: 6 }}>({it.paid_qty} ya cobrado)</span>}
                          </span>
                          <span style={{ fontWeight: 600 }}>{formatCOP(it.pending_qty * Number(it.unit_price))}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Totals Breakdown */}
                <div style={{ backgroundColor: "var(--color-surface-secondary)", padding: 14, borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>Subtotal pendiente:</span>
                    <span style={{ fontWeight: 600 }}>{formatCOP(consumptionToPay)}</span>
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

                {/* Warning if not billable */}
                {tableSummary && !tableSummary.is_billable && (
                  <div className="alert-box alert-warning" style={{ margin: "10px 0" }}>
                    <span><strong>Mesa no habilitada para cobro:</strong> Los pedidos deben estar entregados al cliente y el mesero debe haber solicitado la cuenta antes de proceder al cobro.</span>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="form-label">Método de pago presencial</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 }}>
                    {(["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const).map((m) => (
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
                  disabled={paying || consumptionToPay <= 0 || (tableSummary && !tableSummary.is_billable)}
                  className="btn btn-primary"
                  style={{ height: 46, fontSize: 15, width: "100%", marginTop: 6 }}
                >
                  <CreditCard size={18} />
                  <span>{paying ? "Procesando pago..." : "Confirmar cobro y emitir factura"}</span>
                </button>
              </>
              )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRAWER: ABRIR CAJA */}
      <Drawer
        isOpen={Boolean(openRegisterModal)}
        onClose={() => setOpenRegisterModal(null)}
        title={openRegisterModal ? `Abrir ${openRegisterModal.name}` : "Abrir Caja"}
        subtitle="Ingresa la base inicial en efectivo para abrir el turno."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setOpenRegisterModal(null)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-open-register" className="btn btn-primary">
              Confirmar apertura
            </button>
          </>
        }
      >
        {openRegisterModal && (
          <form id="form-open-register" onSubmit={handleOpenRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Base en efectivo inicial (COP) *</label>
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
          </form>
        )}
      </Drawer>

      {/* DRAWER: CIERRE DE CAJA / ARQUEO (Stitch cierre_de_caja_potoquitos) */}
      <Drawer
        isOpen={Boolean(closeRegisterModal)}
        onClose={() => setCloseRegisterModal(null)}
        title="Arqueo y Cierre de Turno"
        subtitle="Totaliza el efectivo físico y asienta novedades de cierre de caja."
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setCloseRegisterModal(null)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-close-register" className="btn btn-danger">
              Confirmar Cierre de Caja
            </button>
          </>
        }
      >
        {closeRegisterModal && (
          <form id="form-close-register" onSubmit={handleCloseRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Efectivo contado en gaveta (COP) *</label>
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
                rows={4}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Detalles de arqueo, entrega de turno o novedades..."
                className="form-textarea"
              />
            </div>
          </form>
        )}
      </Drawer>

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
