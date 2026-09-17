import React, { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Drawer } from "../../components/Drawer";
import { IconButton } from "../../components/IconButton";
import {
  Package,
  History,
  BookOpen,
  Plus,
  ArrowDownRight,
  TriangleAlert,
  Search,
  Filter,
  X,
  CheckCircle2,
  Pencil,
  PackagePlus,
  Trash2,
  Eye,
  RefreshCw,
  Power,
} from "lucide-react";

type Ingredient = {
  id: number;
  name: string;
  base_unit: string;
  stock: number | string;
  current_stock?: number | string;
  min_stock: number | string;
  reference_cost: number | string;
  description?: string;
  is_active: boolean;
};

type KardexEntry = {
  id: number;
  ingredient_name: string;
  unit: string;
  movement_type: string;
  quantity: number;
  balance_before: number | string;
  balance_after: number | string;
  reference?: string;
  actor_name?: string;
  responsible_name?: string;
  created_at: string;
};

type RecipeItem = {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
};

type ProductRecipe = {
  product_id: number;
  product_name: string;
  sale_price: number;
  cost: number;
  margin_percentage: number;
  capacity: number;
  limiting_ingredient?: string;
  items: RecipeItem[];
};

export function InventoryPage() {
  const { accessToken, hasRole } = useAuth();
  const token = accessToken!;

  const [activeTab, setActiveTab] = useState<"STOCK" | "KARDEX" | "RECIPES">("STOCK");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kardex, setKardex] = useState<KardexEntry[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Search & Filter (Insumos)
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");

  // Kardex Filters (Histórico)
  const [kardexFromDate, setKardexFromDate] = useState("");
  const [kardexToDate, setKardexToDate] = useState("");
  const [kardexIngredientId, setKardexIngredientId] = useState<string>("ALL");
  const [kardexMovementType, setKardexMovementType] = useState<string>("ALL");
  const [kardexSearch, setKardexSearch] = useState("");
  const [loadingKardex, setLoadingKardex] = useState(false);

  // Drawer: New / Edit Ingredient
  const [isIngDrawerOpen, setIsIngDrawerOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingFormName, setIngFormName] = useState("");
  const [ingFormUnit, setIngFormUnit] = useState("kg");
  const [ingFormMinStock, setIngFormMinStock] = useState<number | string>(5);
  const [ingFormCost, setIngFormCost] = useState<number | string>(15000);
  const [ingFormInitialStock, setIngFormInitialStock] = useState<number | string>(0);
  const [ingFormDescription, setIngFormDescription] = useState("");

  // Drawer: Registrar Entrada
  const [isEntradaDrawerOpen, setIsEntradaDrawerOpen] = useState(false);
  const [entradaIngId, setEntradaIngId] = useState<number | null>(null);
  const [entradaQty, setEntradaQty] = useState<number | string>(1);
  const [entradaMotivo, setEntradaMotivo] = useState("COMPRA_LOCAL");
  const [entradaNotas, setEntradaNotas] = useState("");

  // Modal: Merma o Ajuste
  const [ajusteModal, setAjusteModal] = useState<{
    ingredient: Ingredient;
    type: "MERMA" | "AJUSTE_NEGATIVO" | "AJUSTE_POSITIVO";
  } | null>(null);
  const [ajusteQty, setAjusteQty] = useState<number | string>(1);
  const [ajusteMotivo, setAjusteMotivo] = useState("DETERIORO");
  const [ajusteNotas, setAjusteNotas] = useState("");

  // Modal: Kardex por ingrediente
  const [selectedKardexIng, setSelectedKardexIng] = useState<Ingredient | null>(null);

  // Selected recipe
  const [selectedRecipe, setSelectedRecipe] = useState<ProductRecipe | null>(null);

  const formatCOP = (val: number | string) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(val) || 0);

  async function loadData() {
    try {
      setLoading(true);
      const [iRes, kRes, rRes] = await Promise.all([
        apiRequest<any>("/inventory/ingredients", {}, token).catch(() => []),
        apiRequest<any>("/inventory/kardex", {}, token).catch(() => []),
        apiRequest<any>("/inventory/recipes", {}, token).catch(() => []),
      ]);
      const iList = Array.isArray(iRes) ? iRes : (iRes?.items || []);
      const kList = Array.isArray(kRes) ? kRes : (kRes?.items || []);
      const rList = Array.isArray(rRes) ? rRes : (rRes?.items || []);
      setIngredients(iList);
      setKardex(kList);
      setRecipes(rList);
      if (rList.length > 0 && !selectedRecipe) {
        setSelectedRecipe(rList[0]);
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadKardex(from?: string, to?: string, ingId?: string, mType?: string, srch?: string) {
    try {
      setLoadingKardex(true);
      const params = new URLSearchParams();
      if (from) params.set("from_date", from);
      if (to) params.set("to_date", to);
      if (ingId && ingId !== "ALL") params.set("ingredient_id", ingId);
      if (mType && mType !== "ALL") params.set("movement_type", mType);
      if (srch) params.set("search", srch);
      const res = await apiRequest<any>(`/inventory/kardex?${params.toString()}`, {}, token);
      const kList = Array.isArray(res) ? res : (res?.items || []);
      setKardex(kList);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoadingKardex(false);
    }
  }

  function handleFilterKardex(e: React.FormEvent) {
    e.preventDefault();
    loadKardex(kardexFromDate, kardexToDate, kardexIngredientId, kardexMovementType, kardexSearch);
  }

  function handleClearKardexFilters() {
    setKardexFromDate("");
    setKardexToDate("");
    setKardexIngredientId("ALL");
    setKardexMovementType("ALL");
    setKardexSearch("");
    loadKardex("", "", "ALL", "ALL", "");
  }

  useEffect(() => {
    loadData();
  }, [token]);

  // Open Drawer for Create
  function openCreateDrawer() {
    setEditingIngredient(null);
    setIngFormName("");
    setIngFormUnit("kg");
    setIngFormMinStock(5);
    setIngFormCost(15000);
    setIngFormInitialStock(0);
    setIngFormDescription("");
    setIsIngDrawerOpen(true);
  }

  // Open Drawer for Edit
  function openEditDrawer(ing: Ingredient) {
    setEditingIngredient(ing);
    setIngFormName(ing.name);
    setIngFormUnit(ing.base_unit || "kg");
    setIngFormMinStock(Number(ing.min_stock) || 0);
    setIngFormCost(Number(ing.reference_cost) || 0);
    setIngFormInitialStock(Number(ing.stock ?? ing.current_stock) || 0);
    setIngFormDescription(ing.description || "");
    setIsIngDrawerOpen(true);
  }

  // Save (Create or Update) Ingredient
  async function handleSaveIngredient(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingIngredient) {
        await apiRequest(
          `/inventory/ingredients/${editingIngredient.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: ingFormName,
              base_unit: ingFormUnit,
              min_stock: Number(ingFormMinStock),
              reference_cost: Number(ingFormCost),
              description: ingFormDescription,
              is_active: editingIngredient.is_active,
            }),
          },
          token
        );
        setSuccessMessage("Ingrediente actualizado correctamente.");
      } else {
        await apiRequest(
          "/inventory/ingredients",
          {
            method: "POST",
            body: JSON.stringify({
              name: ingFormName,
              base_unit: ingFormUnit,
              min_stock: Number(ingFormMinStock),
              reference_cost: Number(ingFormCost),
              stock: Number(ingFormInitialStock),
              description: ingFormDescription,
              is_active: true,
            }),
          },
          token
        );
        setSuccessMessage("Ingrediente creado correctamente con su stock inicial en Kardex.");
      }
      setIsIngDrawerOpen(false);
      await loadData();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Open Entrada Drawer
  function openEntradaDrawer(ingId?: number) {
    setEntradaIngId(ingId || (ingredients[0]?.id ?? null));
    setEntradaQty(1);
    setEntradaMotivo("COMPRA_LOCAL");
    setEntradaNotas("");
    setIsEntradaDrawerOpen(true);
  }

  // Submit Entrada
  async function handleSubmitEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!entradaIngId) return;
    try {
      const selected = ingredients.find((i) => i.id === entradaIngId);
      const motivoLabel =
        entradaMotivo === "COMPRA_LOCAL"
          ? "Compra / Reposición regular"
          : entradaMotivo === "DONACION"
          ? "Aporte de insumos"
          : "Producción interna";
      const reference = entradaNotas
        ? `${motivoLabel}: ${entradaNotas}`
        : motivoLabel;

      await apiRequest(
        "/inventory/movements",
        {
          method: "POST",
          body: JSON.stringify({
            ingredient_id: entradaIngId,
            movement_type: "ENTRADA_MANUAL",
            quantity: Number(entradaQty),
            reference,
          }),
        },
        token
      );
      setIsEntradaDrawerOpen(false);
      setSuccessMessage(`Entrada de ${entradaQty} ${selected?.base_unit || "unidades"} confirmada.`);
      await loadData();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Submit Merma o Ajuste
  async function handleSubmitAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!ajusteModal) return;
    try {
      const motivoLabel =
        ajusteMotivo === "DETERIORO"
          ? "Deterioro / Caducidad"
          : ajusteMotivo === "ERROR_COCINA"
          ? "Error en preparación"
          : "Diferencia inventario físico";
      const reference = ajusteNotas
        ? `${motivoLabel}: ${ajusteNotas}`
        : motivoLabel;

      await apiRequest(
        "/inventory/movements",
        {
          method: "POST",
          body: JSON.stringify({
            ingredient_id: ajusteModal.ingredient.id,
            movement_type: ajusteModal.type,
            quantity: Number(ajusteQty),
            reference,
          }),
        },
        token
      );
      setAjusteModal(null);
      setSuccessMessage(`Ajuste registrado en Kardex.`);
      await loadData();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // Toggle Inactive / Active
  async function toggleActiveStatus(ing: Ingredient) {
    try {
      await apiRequest(
        `/inventory/ingredients/${ing.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: ing.name,
            base_unit: ing.base_unit,
            min_stock: Number(ing.min_stock),
            reference_cost: Number(ing.reference_cost),
            description: ing.description,
            is_active: !ing.is_active,
          }),
        },
        token
      );
      setSuccessMessage(
        ing.is_active
          ? `Ingrediente "${ing.name}" desactivado.`
          : `Ingrediente "${ing.name}" reactivado.`
      );
      await loadData();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  // KPI calculations
  const totalActive = ingredients.filter((i) => i.is_active).length;
  const criticalCount = ingredients.filter(
    (i) => i.is_active && Number(i.stock ?? i.current_stock) <= Number(i.min_stock)
  ).length;
  const lowCount = ingredients.filter((i) => {
    if (!i.is_active) return false;
    const st = Number(i.stock ?? i.current_stock);
    const min = Number(i.min_stock);
    return st > min && st <= min * 1.5;
  }).length;

  // Filtered ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = ing.name.toLowerCase().includes(q);
      const matchId = String(ing.id).includes(q);
      const matchDesc = ing.description ? ing.description.toLowerCase().includes(q) : false;
      if (!matchName && !matchId && !matchDesc) return false;
    }

    if (unitFilter !== "ALL" && ing.base_unit !== unitFilter) return false;

    if (stateFilter !== "ALL") {
      if (stateFilter === "Inactivo") {
        if (ing.is_active) return false;
      } else {
        if (!ing.is_active) return false;
        const st = Number(ing.stock ?? ing.current_stock);
        const min = Number(ing.min_stock);
        if (stateFilter === "Crítico" && st > 0) return false;
        if (stateFilter === "Bajo" && (st <= 0 || st > min)) return false;
        if (stateFilter === "Normal" && st <= min) return false;
      }
    }
    return true;
  });

  const selectedEntradaIng = ingredients.find((i) => i.id === entradaIngId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ENCABEZADO DE PÁGINA (Stitch inventario_potoquitos) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
            Inventario
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Controla ingredientes, existencias y movimientos de inventario de POTOQUITOS.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasRole("ADMINISTRADOR") && (
            <button onClick={openCreateDrawer} className="btn btn-secondary" type="button">
              <Plus size={18} />
              <span>Nuevo ingrediente</span>
            </button>
          )}

          <button onClick={() => openEntradaDrawer()} className="btn btn-primary" type="button">
            <Package size={18} />
            <span>Registrar entrada</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {message && (
        <div className="alert-box alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ cursor: "pointer", color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="alert-box alert-success" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} style={{ cursor: "pointer", color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* RESUMEN DE INDICADORES (3 CARDS COMPACTOS SEGÚN STITCH) */}
      <div className="grid-3">
        {/* Card 1: Total Ingredientes */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Total Ingredientes</span>
            <div className="kpi-value">{totalActive}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Ingredientes activos registrados</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
            <Package size={24} />
          </div>
        </div>

        {/* Card 2: Stock Crítico */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Stock Crítico</span>
            <div className="kpi-value" style={{ color: "var(--color-secondary)" }}>{criticalCount}</div>
            <span style={{ fontSize: 11, color: "var(--color-secondary)", fontWeight: 600 }}>Requieren reposición inmediata</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}>
            <TriangleAlert size={24} />
          </div>
        </div>

        {/* Card 3: Stock Bajo */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Stock Bajo</span>
            <div className="kpi-value" style={{ color: "var(--color-warning)" }}>{lowCount}</div>
            <span style={{ fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>Próximos a stock mínimo</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-warning-soft)", color: "var(--color-warning)" }}>
            <Package size={24} />
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", gap: 24 }}>
        <button
          onClick={() => setActiveTab("STOCK")}
          style={{
            padding: "10px 4px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "STOCK" ? "var(--color-primary)" : "var(--color-text-secondary)",
            borderBottom: activeTab === "STOCK" ? "3px solid var(--color-primary)" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <Package size={17} />
          <span>Insumos y Stock</span>
        </button>

        <button
          onClick={() => setActiveTab("KARDEX")}
          style={{
            padding: "10px 4px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "KARDEX" ? "var(--color-primary)" : "var(--color-text-secondary)",
            borderBottom: activeTab === "KARDEX" ? "3px solid var(--color-primary)" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <History size={17} />
          <span>Kardex General ({kardex.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("RECIPES")}
          style={{
            padding: "10px 4px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "RECIPES" ? "var(--color-primary)" : "var(--color-text-secondary)",
            borderBottom: activeTab === "RECIPES" ? "3px solid var(--color-primary)" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <BookOpen size={17} />
          <span>Fichas Técnicas / Recetas ({recipes.length})</span>
        </button>
      </div>

      {/* TAB 1: STOCK & INSUMOS */}
      {activeTab === "STOCK" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* FILTROS Y BÚSQUEDA (Stitch inventario_potoquitos) */}
          <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 280, flexWrap: "wrap" }}>
              {/* Buscador */}
              <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <input
                  type="text"
                  placeholder="Buscar ingrediente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ height: 38, paddingLeft: 38, fontSize: 13 }}
                />
              </div>

              {/* Filtro Estado */}
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="form-select"
                style={{ height: 38, width: 160, fontSize: 13 }}
              >
                <option value="ALL">Todos los estados</option>
                <option value="Crítico">Crítico</option>
                <option value="Bajo">Bajo</option>
                <option value="Normal">Normal</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              {/* Filtro Unidad */}
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="form-select"
                style={{ height: 38, width: 150, fontSize: 13 }}
              >
                <option value="ALL">Todas las unidades</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="und">und</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="porcion">porcion</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                Mostrando {filteredIngredients.length} de {ingredients.length} ingredientes
              </span>
              <button
                onClick={() => {
                  setSearch("");
                  setStateFilter("ALL");
                  setUnitFilter("ALL");
                }}
                className="btn btn-secondary btn-sm"
                type="button"
              >
                <span>Limpiar</span>
              </button>
            </div>
          </div>

          {/* TABLA PRINCIPAL DE INGREDIENTES (Stitch inventario_potoquitos) */}
          <div className="table-container">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Unidad Base</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Costo Ref (COP)</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--color-text-muted)" }}>
                        No se encontraron ingredientes con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredIngredients.map((ing) => {
                      const st = Number(ing.stock ?? ing.current_stock) || 0;
                      const min = Number(ing.min_stock) || 0;
                      const isCritical = ing.is_active && st <= min;
                      const isLow = ing.is_active && !isCritical && st <= min * 1.5;

                      return (
                        <tr key={ing.id}>
                          <td>
                            <strong style={{ display: "block", fontSize: 13, color: "var(--color-text-primary)" }}>
                              {ing.name}
                            </strong>
                            {ing.description && (
                              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                {ing.description}
                              </span>
                            )}
                          </td>
                          <td style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
                            {ing.base_unit}
                          </td>
                          <td style={{ fontWeight: 800, color: !ing.is_active ? "var(--color-text-muted)" : isCritical ? "var(--color-secondary)" : isLow ? "var(--color-warning)" : "var(--color-text-primary)" }}>
                            {st} {ing.base_unit}
                          </td>
                          <td style={{ color: "var(--color-text-secondary)" }}>
                            {min} {ing.base_unit}
                          </td>
                          <td style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                            {formatCOP(ing.reference_cost)} / {ing.base_unit}
                          </td>
                          <td>
                            {!ing.is_active ? (
                              <span className="badge badge-neutral">
                                <span className="badge-dot" /> Inactivo
                              </span>
                            ) : isCritical ? (
                              <span className="badge badge-danger">
                                <span className="badge-dot" /> Crítico
                              </span>
                            ) : isLow ? (
                              <span className="badge badge-warning">
                                <span className="badge-dot" /> Bajo
                              </span>
                            ) : (
                              <span className="badge badge-success">
                                <span className="badge-dot" /> Normal
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              {/* Entrada de existencias */}
                              <IconButton
                                icon={PackagePlus}
                                tooltip="Registrar entrada de existencias"
                                variant="primary"
                                onClick={() => openEntradaDrawer(ing.id)}
                              />

                              {/* Registrar Merma */}
                              <IconButton
                                icon={TriangleAlert}
                                tooltip="Registrar merma o ajuste"
                                variant="warning"
                                onClick={() => setAjusteModal({ ingredient: ing, type: "MERMA" })}
                              />

                              {/* Ver Kardex */}
                              <IconButton
                                icon={History}
                                tooltip="Ver historial de Kardex"
                                variant="default"
                                onClick={() => setSelectedKardexIng(ing)}
                              />

                              {/* Editar datos */}
                              {hasRole("ADMINISTRADOR") && (
                                <IconButton
                                  icon={Pencil}
                                  tooltip="Editar ingrediente"
                                  variant="primary"
                                  onClick={() => openEditDrawer(ing)}
                                />
                              )}

                              {/* Inactivar / Reactivar */}
                              {hasRole("ADMINISTRADOR") && (
                                <IconButton
                                  icon={Power}
                                  tooltip={ing.is_active ? "Inactivar ingrediente" : "Reactivar ingrediente"}
                                  variant={ing.is_active ? "danger" : "success"}
                                  onClick={() => toggleActiveStatus(ing)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KARDEX GENERAL */}
      {activeTab === "KARDEX" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* BARRA DE FILTROS HISTÓRICOS DE KARDEX */}
          <form
            onSubmit={handleFilterKardex}
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              borderLeft: "4px solid var(--color-primary)",
            }}
          >
            {/* Rango de Fechas */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Desde:</span>
              <input
                type="date"
                value={kardexFromDate}
                onChange={(e) => setKardexFromDate(e.target.value)}
                className="form-input"
                style={{ height: 34, fontSize: 13, padding: "4px 8px" }}
                id="input-kardex-from"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Hasta:</span>
              <input
                type="date"
                value={kardexToDate}
                onChange={(e) => setKardexToDate(e.target.value)}
                className="form-input"
                style={{ height: 34, fontSize: 13, padding: "4px 8px" }}
                id="input-kardex-to"
              />
            </div>

            {/* Insumo */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Insumo:</span>
              <select
                value={kardexIngredientId}
                onChange={(e) => setKardexIngredientId(e.target.value)}
                className="form-select"
                style={{ height: 34, fontSize: 13, minWidth: 160 }}
                id="select-kardex-ing"
              >
                <option value="ALL">Todos los insumos</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de movimiento */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>Tipo:</span>
              <select
                value={kardexMovementType}
                onChange={(e) => setKardexMovementType(e.target.value)}
                className="form-select"
                style={{ height: 34, fontSize: 13, minWidth: 170 }}
                id="select-kardex-type"
              >
                <option value="ALL">Todos los tipos</option>
                <option value="ENTRADA_MANUAL">Entrada Manual</option>
                <option value="CONSUMO_PREPARACION">Consumo Preparación</option>
                <option value="MERMA">Merma / Desperdicio</option>
                <option value="AJUSTE_POSITIVO">Ajuste Positivo</option>
                <option value="AJUSTE_NEGATIVO">Ajuste Negativo</option>
                <option value="REVERSION">Reversión</option>
              </select>
            </div>

            {/* Buscar texto */}
            <div style={{ position: "relative", minWidth: 180, flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar en referencia / notas..."
                value={kardexSearch}
                onChange={(e) => setKardexSearch(e.target.value)}
                className="form-input"
                style={{ height: 34, paddingLeft: 30, fontSize: 13 }}
                id="input-kardex-search"
              />
            </div>

            {/* Botones de acción */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loadingKardex} id="btn-kardex-filter">
                <span>{loadingKardex ? "Filtrando..." : "Filtrar"}</span>
              </button>
              <button
                type="button"
                onClick={handleClearKardexFilters}
                className="btn btn-secondary btn-sm"
                id="btn-kardex-clear"
              >
                <span>Limpiar filtros</span>
              </button>
            </div>
          </form>

          {/* TABLA PRINCIPAL DE KARDEX */}
          <div className="table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  Libro Mayor de Kardex Operacional
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  Registro inmutable de movimientos históricos con saldo anterior y saldo posterior persistidos.
                </p>
              </div>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 600 }}>
                {kardex.length} movimientos encontrados
              </span>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Insumo</th>
                    <th>Tipo Movimiento</th>
                    <th style={{ textAlign: "right" }}>Cantidad</th>
                    <th style={{ textAlign: "right" }}>Stock Anterior</th>
                    <th style={{ textAlign: "right" }}>Stock Posterior</th>
                    <th>Referencia / Origen</th>
                    <th>Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kardex.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "var(--color-text-muted)" }}>
                        No se encontraron registros en el Kardex para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    kardex.map((k) => {
                      const isEntry =
                        k.movement_type === "ENTRADA_MANUAL" ||
                        k.movement_type === "AJUSTE_POSITIVO" ||
                        k.movement_type === "REVERSION";

                      return (
                        <tr key={k.id}>
                          <td style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                            {new Date(k.created_at).toLocaleString("es-CO")}
                          </td>
                          <td style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>
                            {k.ingredient_name}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                isEntry
                                  ? "badge-success"
                                  : k.movement_type === "MERMA"
                                  ? "badge-warning"
                                  : "badge-danger"
                              }`}
                            >
                              {k.movement_type}
                            </span>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: isEntry ? "var(--color-tertiary)" : "var(--color-secondary)",
                            }}
                          >
                            {isEntry ? `+${k.quantity}` : `-${k.quantity}`} {k.unit}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                            {k.balance_before != null ? `${k.balance_before} ${k.unit}` : "-"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800, color: "var(--color-text-primary)" }}>
                            {k.balance_after != null ? `${k.balance_after} ${k.unit}` : "-"}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                            {k.reference || "N/A"}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                            {k.actor_name || k.responsible_name || "Sistema"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECETAS & FICHAS TÉCNICAS */}
      {activeTab === "RECIPES" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr", gap: 20, alignItems: "flex-start" }}>
          {/* List of Products */}
          <div className="table-container">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Fichas Técnicas y Capacidad</h3>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                Porciones máximas calculadas en vivo a partir de existencias reales en bodega.
              </p>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plato</th>
                    <th style={{ textAlign: "right" }}>P. Venta</th>
                    <th style={{ textAlign: "right" }}>Costo Insumos</th>
                    <th style={{ textAlign: "right" }}>Capacidad</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((r) => {
                    const isSelected = selectedRecipe?.product_id === r.product_id;
                    return (
                      <tr
                        key={r.product_id}
                        onClick={() => setSelectedRecipe(r)}
                        style={{
                          cursor: "pointer",
                          backgroundColor: isSelected ? "var(--color-primary-soft)" : "transparent",
                        }}
                      >
                        <td>
                          <strong style={{ fontSize: 13 }}>{r.product_name}</strong>
                          {r.limiting_ingredient && (
                            <span style={{ display: "block", fontSize: 11, color: "var(--color-secondary)" }}>
                              Limita: {r.limiting_ingredient}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCOP(r.sale_price)}</td>
                        <td style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>{formatCOP(r.cost)}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className={`badge ${r.capacity > 10 ? "badge-success" : r.capacity > 0 ? "badge-warning" : "badge-danger"}`}>
                            {r.capacity} porciones
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Technical Recipe Details */}
          <div className="card" style={{ padding: 20 }}>
            {selectedRecipe ? (
              <div>
                <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
                  <span className="badge badge-info" style={{ marginBottom: 6 }}>Ficha Técnica Oficial</span>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{selectedRecipe.product_name}</h3>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 13 }}>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Precio: </span>
                      <strong>{formatCOP(selectedRecipe.sale_price)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Costo receta: </span>
                      <strong style={{ color: "var(--color-primary)" }}>{formatCOP(selectedRecipe.cost)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-text-muted)" }}>Margen bruto: </span>
                      <strong style={{ color: "var(--color-tertiary)" }}>{selectedRecipe.margin_percentage}%</strong>
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ingredientes por Porción Servida</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedRecipe.items.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        backgroundColor: "var(--color-surface-secondary)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{it.ingredient_name}</span>
                      <span style={{ fontWeight: 700 }}>
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Selecciona una receta para ver sus detalles.</p>
            )}
          </div>
        </div>
      )}

      {/* DRAWER: NUEVO / EDITAR INGREDIENTE (Stitch slide-over) */}
      <Drawer
        isOpen={isIngDrawerOpen}
        onClose={() => setIsIngDrawerOpen(false)}
        title={editingIngredient ? "Editar Ingrediente" : "Nuevo Ingrediente"}
        subtitle="Registra o actualiza ingredientes base para costeo y control de stock"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={() => setIsIngDrawerOpen(false)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-ingredient"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {editingIngredient ? "Guardar Cambios" : "Crear Ingrediente"}
            </button>
          </div>
        }
      >
        <form id="form-ingredient" onSubmit={handleSaveIngredient} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nombre del ingrediente *</label>
            <input
              type="text"
              required
              placeholder="Ej. Carne de res molida"
              value={ingFormName}
              onChange={(e) => setIngFormName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Unidad base *</label>
              <select
                value={ingFormUnit}
                onChange={(e) => setIngFormUnit(e.target.value)}
                className="form-select"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="und">Unidades (und)</option>
                <option value="L">Litros (L)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="porcion">Porción</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Stock mínimo de alerta *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={ingFormMinStock}
                onChange={(e) => setIngFormMinStock(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Costo referencial por unidad (COP) *</label>
            <input
              type="number"
              step="100"
              min="0"
              required
              value={ingFormCost}
              onChange={(e) => setIngFormCost(e.target.value)}
              className="form-input"
            />
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Valor: {formatCOP(ingFormCost)} por {ingFormUnit}
            </span>
          </div>

          {!editingIngredient && (
            <div className="form-group">
              <label className="form-label">Stock inicial en bodega</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ingFormInitialStock}
                onChange={(e) => setIngFormInitialStock(e.target.value)}
                className="form-input"
              />
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                Si es mayor a 0, se creará automáticamente la entrada inicial en Kardex.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Descripción o notas (opcional)</label>
            <textarea
              rows={3}
              value={ingFormDescription}
              onChange={(e) => setIngFormDescription(e.target.value)}
              placeholder="Detalles sobre proveedores, marcas o especificaciones..."
              className="form-textarea"
            />
          </div>
        </form>
      </Drawer>

      {/* DRAWER: REGISTRAR ENTRADA (Stitch slide-over) */}
      <Drawer
        isOpen={isEntradaDrawerOpen}
        onClose={() => setIsEntradaDrawerOpen(false)}
        title="Registrar Entrada"
        subtitle="Añadir existencias físicas con trazabilidad en Kardex"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={() => setIsEntradaDrawerOpen(false)}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-entrada"
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Confirmar Entrada
            </button>
          </div>
        }
      >
        <form id="form-entrada" onSubmit={handleSubmitEntrada} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Ingrediente seleccionado *</label>
            <select
              value={entradaIngId ?? ""}
              onChange={(e) => setEntradaIngId(Number(e.target.value))}
              className="form-select"
            >
              {ingredients
                .filter((i) => i.is_active)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.stock ?? i.current_stock} {i.base_unit} disponibles)
                  </option>
                ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Cantidad a ingresar *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={entradaQty}
                onChange={(e) => setEntradaQty(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unidad de medida</label>
              <input
                type="text"
                readOnly
                value={selectedEntradaIng?.base_unit || "kg"}
                className="form-input"
                style={{ backgroundColor: "var(--color-surface-secondary)", fontWeight: 700 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de ingreso</label>
            <select
              value={entradaMotivo}
              onChange={(e) => setEntradaMotivo(e.target.value)}
              className="form-select"
            >
              <option value="COMPRA_LOCAL">Compra / Reposición regular</option>
              <option value="DONACION">Aporte de insumos de emergencia</option>
              <option value="PRODUCCION_INTERNA">Producción interna de cocina</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Nota u observación (opcional)</label>
            <textarea
              rows={3}
              value={entradaNotas}
              onChange={(e) => setEntradaNotas(e.target.value)}
              placeholder="Detalle de factura de compra, lote o proveedor..."
              className="form-textarea"
            />
          </div>

          <div className="card" style={{ backgroundColor: "var(--color-primary-soft)", borderColor: "var(--color-primary)", padding: 12 }}>
            <span style={{ fontSize: 12, color: "var(--color-primary)" }}>
              Toda entrada actualiza el stock físico de forma inmediata y queda asentada en el Kardex inmutable.
            </span>
          </div>
        </form>
      </Drawer>

      {/* DRAWER: REGISTRAR MERMA O AJUSTE */}
      <Drawer
        isOpen={Boolean(ajusteModal)}
        onClose={() => setAjusteModal(null)}
        title={ajusteModal?.type === "MERMA" ? "Registrar Merma" : "Registrar Ajuste"}
        subtitle={ajusteModal ? `Ingrediente: ${ajusteModal.ingredient.name} • Stock actual: ${ajusteModal.ingredient.stock ?? ajusteModal.ingredient.current_stock} ${ajusteModal.ingredient.base_unit}` : ""}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setAjusteModal(null)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-ajuste" className="btn btn-danger">
              Guardar Ajuste
            </button>
          </>
        }
      >
        {ajusteModal && (
          <form id="form-ajuste" onSubmit={handleSubmitAjuste} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 12, borderRadius: "var(--radius-md)", backgroundColor: "var(--color-surface-secondary)" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Ingrediente a afectar:</span>
              <strong style={{ display: "block", fontSize: 14 }}>{ajusteModal.ingredient.name}</strong>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Stock actual: {ajusteModal.ingredient.stock ?? ajusteModal.ingredient.current_stock} {ajusteModal.ingredient.base_unit}
              </span>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Cantidad afectada *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={ajusteQty}
                  onChange={(e) => setAjusteQty(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Causa / Tipo</label>
                <select
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  className="form-select"
                >
                  <option value="DETERIORO">Deterioro / Caducidad</option>
                  <option value="ERROR_COCINA">Error en preparación</option>
                  <option value="CONTEO_FISICO">Diferencia inventario</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Justificación detallada *</label>
              <textarea
                rows={4}
                required
                value={ajusteNotas}
                onChange={(e) => setAjusteNotas(e.target.value)}
                placeholder="Explica la razón de la pérdida o ajuste físico..."
                className="form-textarea"
              />
            </div>
          </form>
        )}
      </Drawer>

      {/* DRAWER: KARDEX ESPECÍFICO POR INGREDIENTE */}
      <Drawer
        isOpen={Boolean(selectedKardexIng)}
        onClose={() => setSelectedKardexIng(null)}
        title={selectedKardexIng ? `Kardex: ${selectedKardexIng.name}` : "Kardex"}
        subtitle={selectedKardexIng ? `Stock actual: ${selectedKardexIng.stock ?? selectedKardexIng.current_stock} ${selectedKardexIng.base_unit}` : ""}
        size="lg"
        footer={
          <button onClick={() => setSelectedKardexIng(null)} className="btn btn-secondary">
            Cerrar
          </button>
        }
      >
        {selectedKardexIng && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Movimiento</th>
                  <th style={{ textAlign: "right" }}>Cantidad</th>
                  <th style={{ textAlign: "right" }}>Saldo Final</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {kardex
                  .filter((k) => k.ingredient_name === selectedKardexIng.name)
                  .map((k) => {
                    const isEntry =
                      k.movement_type === "ENTRADA_MANUAL" ||
                      k.movement_type === "AJUSTE_POSITIVO" ||
                      k.movement_type === "REVERSION";
                    return (
                      <tr key={k.id}>
                        <td style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                          {new Date(k.created_at).toLocaleString("es-CO")}
                        </td>
                        <td>
                          <span className={`badge ${isEntry ? "badge-success" : "badge-danger"}`}>
                            {k.movement_type}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: isEntry ? "var(--color-tertiary)" : "var(--color-secondary)" }}>
                          {isEntry ? `+${k.quantity}` : `-${k.quantity}`} {k.unit}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800 }}>
                          {k.balance_after} {k.unit}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                          {k.reference || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </div>
  );
}
