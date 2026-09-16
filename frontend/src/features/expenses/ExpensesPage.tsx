import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Drawer } from "../../components/Drawer";
import {
  CircleDollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  X,
  TrendingDown,
  PieChart,
  FileSpreadsheet,
} from "lucide-react";

type ExpenseCategory = {
  id: number;
  name: string;
};

type Expense = {
  id: number;
  description: string;
  category_id: number;
  category_name?: string;
  is_fixed: boolean;
  amount: number;
  incurred_at: string;
  recorded_by_name?: string;
};

export function ExpensesPage() {
  const { accessToken } = useAuth();
  const token = accessToken!;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Search and filters
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [description, setDescription] = useState("");
  const [catId, setCatId] = useState<number>(1);
  const [isFixed, setIsFixed] = useState(false);
  const [amount, setAmount] = useState(50000);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val));

  async function loadExpenses() {
    try {
      setLoading(true);
      const [eRes, cRes] = await Promise.all([
        apiRequest<any>("/expenses/", {}, token).catch(() => []),
        apiRequest<any>("/expenses/categories", {}, token).catch(() => []),
      ]);
      const eList = Array.isArray(eRes) ? eRes : (eRes?.items || []);
      const cList = Array.isArray(cRes) ? cRes : (cRes?.items || []);
      setExpenses(eList);
      setCategories(cList);
      if (cList.length > 0 && !catId) setCatId(cList[0].id);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExpenses();
  }, [token]);

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest(
        "/expenses/",
        {
          method: "POST",
          body: JSON.stringify({
            description,
            concept: description,
            category_id: catId,
            is_fixed: isFixed,
            amount,
            incurred_at: new Date(date).toISOString(),
            expense_date: date,
          }),
        },
        token
      );
      setShowModal(false);
      setDescription("");
      setAmount(50000);
      await loadExpenses();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiRequest(
        "/expenses/categories",
        {
          method: "POST",
          body: JSON.stringify({ name: newCatName.trim() }),
        },
        token
      );
      setShowCatModal(false);
      setNewCatName("");
      await loadExpenses();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const fixedExpenses = expenses.filter((e) => e.is_fixed).reduce((sum, e) => sum + Number(e.amount), 0);
  const variableExpenses = totalExpenses - fixedExpenses;

  const filteredExpenses = expenses.filter((e) => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCat !== null && e.category_id !== selectedCat) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Costos Operativos y Gastos
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Control de erogaciones fijas y variables del restaurante para el cálculo de margen real.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowCatModal(true)} className="btn btn-secondary btn-sm">
            <Plus size={16} />
            <span>Nueva Categoría</span>
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="alert-box alert-danger" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")}><X size={16} /></button>
        </div>
      )}

      {/* KPIS (Stitch costos_y_gastos_potoquitos) */}
      <div className="grid-4">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Gastos del Período</span>
            <div className="kpi-value">{formatCOP(totalExpenses)}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{expenses.length} registros</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-secondary-soft)" }}>
            <TrendingDown size={22} color="var(--color-secondary)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Gastos Fijos</span>
            <div className="kpi-value">{formatCOP(fixedExpenses)}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Arriendo, nómina, servicios</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-surface-secondary)" }}>
            <FileSpreadsheet size={22} color="var(--color-text-primary)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Gastos Variables</span>
            <div className="kpi-value">{formatCOP(variableExpenses)}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Mantenimiento, insumos</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-warning-soft)" }}>
            <CircleDollarSign size={22} color="var(--color-warning)" />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Impacto Estimado</span>
            <div className="kpi-value" style={{ color: "var(--color-tertiary)" }}>27.4%</div>
            <span style={{ fontSize: 11, color: "var(--color-tertiary)", fontWeight: 600 }}>Sobre ventas brutas</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-tertiary-soft)" }}>
            <PieChart size={22} color="var(--color-tertiary)" />
          </div>
        </div>
      </div>

      {/* EXPENSES TABLE & FILTERS */}
      <div className="table-container">
        <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative", width: 280 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar por concepto o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ height: 36, paddingLeft: 34, fontSize: 13 }}
              />
            </div>

            <select
              value={selectedCat ?? ""}
              onChange={(e) => setSelectedCat(e.target.value ? Number(e.target.value) : null)}
              className="form-select"
              style={{ height: 36, fontSize: 13, width: 180 }}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Mostrando {filteredExpenses.length} de {expenses.length} gastos
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto / Descripción</th>
                <th>Categoría</th>
                <th>Naturaleza</th>
                <th style={{ textAlign: "right" }}>Monto</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "var(--color-text-muted)" }}>
                    No hay gastos registrados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {new Date(exp.incurred_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 700 }}>{exp.description}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {exp.category_name || "General"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${exp.is_fixed ? "badge-info" : "badge-warning"}`} style={{ fontSize: 11 }}>
                        {exp.is_fixed ? "Fijo" : "Variable"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "var(--color-secondary)" }}>
                      {formatCOP(exp.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {exp.recorded_by_name || "Administrador"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER: REGISTRAR GASTO */}
      <Drawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Gasto Operativo"
        subtitle="Erogaciones para cálculo de margen real y balance operativo"
        width="md"
        footer={
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-expense"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Registrar Gasto
            </button>
          </div>
        }
      >
        <form id="form-expense" onSubmit={handleCreateExpense} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Concepto / Descripción *</label>
            <input
              type="text"
              placeholder="Ej. Pago de recibo de energía eléctrica"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Categoría *</label>
              <select
                value={catId}
                onChange={(e) => setCatId(Number(e.target.value))}
                className="form-select"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de gasto</label>
              <select
                value={isFixed ? "true" : "false"}
                onChange={(e) => setIsFixed(e.target.value === "true")}
                className="form-select"
              >
                <option value="false">Variable</option>
                <option value="true">Fijo</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Monto (COP) *</label>
              <input
                type="number"
                step="1000"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha del gasto *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
        </form>
      </Drawer>
      {/* MODAL: NUEVA CATEGORÍA DE GASTO */}
      {showCatModal && (
        <div className="modal-backdrop" onClick={() => setShowCatModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Nueva Categoría de Gasto</h3>
              <button onClick={() => setShowCatModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre de la categoría</label>
                  <input
                    type="text"
                    placeholder="Ej. Servicios Públicos, Nómina, Insumos"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
