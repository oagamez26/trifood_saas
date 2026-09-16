import React, { useEffect, useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  catalogApi,
  type AdminProduct,
  type Category,
  type History,
  type Page,
} from "../catalogApi";
import { useAuth } from "../../../contexts/AuthContext";
import { ApiError } from "../../../services/api";
import { formatCOP, mediaUrl } from "../../../config/env";
import { Drawer } from "../../../components/Drawer";
import {
  Utensils,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  ExternalLink,
  Search,
  Users,
  Edit2,
  DollarSign,
  Eye,
  EyeOff,
  Power,
  Upload,
  X,
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Lock,
  Camera,
  Trash2,
  Check,
  Soup,
} from "lucide-react";

export function CatalogProductsPage() {
  const { accessToken, hasPermission } = useAuth();
  const token = accessToken!;

  const [result, setResult] = useState<Page<AdminProduct>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [available, setAvailable] = useState("");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Product Drawer States
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [price, setPrice] = useState("");
  const [serves, setServes] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteImageFlag, setDeleteImageFlag] = useState(false);

  // Category Drawer States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | "new" | null>(null);

  // Pricing Modal States
  const [pricing, setPricing] = useState<AdminProduct | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [priceDraft, setPriceDraft] = useState("");

  const refresh = () => setRevision((v) => v + 1);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasPermission("product.view")) return;
    setLoading(true);
    setMessage("");

    const query = new URLSearchParams({
      q: search,
      sort,
      direction,
      page: String(page),
    });
    if (category) query.set("category_id", category);
    if (active) query.set("is_active", active);
    if (available) query.set("is_available", available);

    catalogApi
      .products(token, query, controller.signal)
      .then(setResult)
      .catch((error) => {
        if (error.name !== "AbortError") setMessage(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    token,
    search,
    category,
    active,
    available,
    sort,
    direction,
    page,
    revision,
  ]);

  useEffect(() => {
    if (hasPermission("category.view")) {
      catalogApi
        .categories(token)
        .then(setCategories)
        .catch((error) => setMessage((error as Error).message));
    }
  }, [token, revision]);

  // Sync drawer fields when editing changes
  useEffect(() => {
    if (editing === "new") {
      setSku("HAM-" + Math.floor(100 + Math.random() * 900));
      setName("");
      setDescription("");
      setCategoryId(categories[0]?.id ?? "");
      setPrice("");
      setServes(1);
      setIsActive(true);
      setIsAvailable(true);
      setImageFile(null);
      setImagePreview(null);
      setDeleteImageFlag(false);
    } else if (editing) {
      setSku(editing.internal_code);
      setName(editing.name);
      setDescription(editing.description || "");
      setCategoryId(editing.category_id);
      setPrice(editing.current_price);
      setServes(editing.recommended_people || 1);
      setIsActive(editing.is_active);
      setIsAvailable(editing.is_available);
      setImageFile(null);
      setImagePreview(editing.image_reference ? mediaUrl(editing.image_reference) : null);
      setDeleteImageFlag(false);
    }
  }, [editing, categories]);

  async function action(work: () => Promise<unknown>, successNote?: string) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      if (successNote) {
        setSuccessMsg(successNote);
        setTimeout(() => setSuccessMsg(""), 3500);
      }
      refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage("La imagen supera el límite de 5MB.");
      return;
    }
    setImageFile(file);
    setDeleteImageFlag(false);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleClearImage() {
    setImageFile(null);
    setImagePreview(null);
    setDeleteImageFlag(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setMessage("El nombre del producto es obligatorio.");
      return;
    }
    if (!categoryId) {
      setMessage("Selecciona una categoría válida.");
      return;
    }
    setBusy(true);
    setMessage("");

    try {
      let productId: number;
      if (editing === "new") {
        const cleanPrice = price.replace(/[^0-9.]/g, "");
        if (!cleanPrice) {
          setMessage("Ingresa un precio de venta válido.");
          setBusy(false);
          return;
        }
        const created = await catalogApi.mutate<AdminProduct>(
          token,
          "products",
          {
            internal_code: sku.trim(),
            name: name.trim(),
            description: description.trim(),
            category_id: Number(categoryId),
            current_price: cleanPrice,
            recommended_people: Number(serves),
            is_active: isActive,
            is_available: isAvailable,
          },
          "POST",
        );
        productId = created.id;
      } else {
        productId = (editing as AdminProduct).id;
        await catalogApi.mutate(
          token,
          `products/${productId}`,
          {
            name: name.trim(),
            description: description.trim(),
            category_id: Number(categoryId),
            recommended_people: Number(serves),
            is_active: isActive,
          },
          "PATCH",
        );

        if (isAvailable !== (editing as AdminProduct).is_available) {
          await catalogApi.mutate(
            token,
            `products/${productId}/availability`,
            { is_available: isAvailable },
            "POST",
          );
        }

        const cleanPrice = price.replace(/[^0-9.]/g, "");
        if (cleanPrice && cleanPrice !== (editing as AdminProduct).current_price) {
          await catalogApi.mutate(
            token,
            `products/${productId}/price`,
            {
              current_price: cleanPrice,
              expected_price_version: (editing as AdminProduct).price_version,
            },
            "POST",
          );
        }
      }

      // Upload or Delete Image
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        await catalogApi.image(token, productId, formData);
      } else if (deleteImageFlag && editing !== "new") {
        await catalogApi.deleteImage(token, productId);
      }

      setSuccessMsg(
        editing === "new" ? "Producto creado exitosamente." : "Producto actualizado exitosamente.",
      );
      setTimeout(() => setSuccessMsg(""), 3500);
      setEditing(null);
      refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
      await catalogApi.mutate(
        token,
        editCategory === "new"
          ? "categories"
          : `categories/${(editCategory as Category).id}`,
        {
          name: form.get("name"),
          description: form.get("description"),
          display_order: Number(form.get("display_order")),
        },
        editCategory === "new" ? "POST" : "PATCH",
      );
      setEditCategory(null);
      const updated = await catalogApi.categories(token);
      setCategories(updated);
    }, editCategory === "new" ? "Categoría creada." : "Categoría actualizada.");
  }

  async function openPrice(product: AdminProduct) {
    setPricing(product);
    setPriceDraft(product.current_price);
    try {
      const res = await catalogApi.history(token, product.id);
      setHistory(res.items);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function savePrice(event: FormEvent) {
    event.preventDefault();
    if (!pricing) return;
    setBusy(true);
    setMessage("");
    try {
      const updated = await catalogApi.mutate<AdminProduct>(
        token,
        `products/${pricing.id}/price`,
        {
          current_price: priceDraft,
          expected_price_version: pricing.price_version,
        },
      );
      setPricing(updated);
      setHistory((await catalogApi.history(token, updated.id)).items);
      setSuccessMsg("Precio actualizado correctamente.");
      setTimeout(() => setSuccessMsg(""), 3000);
      refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "PRICE_CONFLICT") {
        try {
          const fresh = await catalogApi.product(token, pricing.id);
          setPricing(fresh);
          setMessage(
            "Conflicto de concurrencia: Otro usuario modificó el precio. Se recargó la versión vigente; revisa antes de guardar.",
          );
        } catch (reloadError) {
          setMessage((reloadError as Error).message);
        }
      } else {
        setMessage((error as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  // KPIs
  const totalProducts = result.total;
  const availableCount = result.items.filter((p) => p.is_available).length;
  const unavailableCount = result.items.filter((p) => !p.is_available).length;

  const current = editing && editing !== "new" ? editing : null;
  const currentCategory =
    editCategory && editCategory !== "new" ? editCategory : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. HEADER & MAIN ACTIONS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Productos y Menú
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Administra los platos, bebidas, precios controlados e inventario de recetas.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            to="/menu"
            className="btn btn-secondary btn-sm"
            title="Vista pública del menú"
          >
            <ExternalLink size={15} />
            <span>Ver menú público</span>
          </Link>

          {hasPermission("category.view") && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCategoryModal(true)}
            >
              <Layers size={15} />
              <span>Gestionar categorías</span>
            </button>
          )}

          {hasPermission("product.create") && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditing("new")}
            >
              <Plus size={16} />
              <span>Nuevo producto</span>
            </button>
          )}
        </div>
      </div>

      {/* ALERTS */}
      {message && (
        <div
          className="alert-box alert-danger"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div
          className="alert-box alert-success"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} style={{ color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. KPI SUMMARY CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div className="kpi-card">
          <div>
            <div className="kpi-label">TOTAL CATÁLOGO</div>
            <div className="kpi-value">{totalProducts}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              productos registrados
            </span>
          </div>
          <div
            className="kpi-icon-box"
            style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
          >
            <Utensils size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">DISPONIBLES VENTA</div>
            <div className="kpi-value" style={{ color: "var(--color-tertiary)" }}>
              {availableCount}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              listos para ordenar
            </span>
          </div>
          <div
            className="kpi-icon-box"
            style={{ backgroundColor: "var(--color-tertiary-soft)", color: "var(--color-tertiary)" }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">AGOTADOS TEMPORALMENTE</div>
            <div className="kpi-value" style={{ color: "var(--color-secondary)" }}>
              {unavailableCount}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              requieren reposición
            </span>
          </div>
          <div
            className="kpi-icon-box"
            style={{ backgroundColor: "var(--color-secondary-soft)", color: "var(--color-secondary)" }}
          >
            <AlertCircle size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">CATEGORÍAS</div>
            <div className="kpi-value" style={{ color: "var(--color-primary)" }}>
              {categories.length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              familias de platos
            </span>
          </div>
          <div
            className="kpi-icon-box"
            style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
          >
            <Layers size={22} />
          </div>
        </div>
      </div>

      {/* 3. FILTERS BAR */}
      <div className="filter-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search
            size={16}
            color="var(--color-text-muted)"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o código interno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="form-select"
          style={{ width: "auto", minWidth: 170 }}
        >
          <option value="">Todas las Categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {!c.is_active ? "(inactiva)" : ""}
            </option>
          ))}
        </select>

        <select
          value={available}
          onChange={(e) => setAvailable(e.target.value)}
          className="form-select"
          style={{ width: "auto", minWidth: 160 }}
        >
          <option value="">Disponibilidad (Todos)</option>
          <option value="true">Disponibles</option>
          <option value="false">Agotados</option>
        </select>

        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="form-select"
          style={{ width: "auto", minWidth: 140 }}
        >
          <option value="">Estado (Todos)</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="form-select"
          style={{ width: "auto", minWidth: 140 }}
        >
          <option value="name">Ordenar: Nombre</option>
          <option value="current_price">Ordenar: Precio</option>
          <option value="internal_code">Ordenar: Código</option>
          <option value="updated_at">Ordenar: Modificado</option>
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
          title="Alternar dirección"
        >
          {direction === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {/* 4. PRODUCTS DATA TABLE */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Foto</th>
                <th>Plato / Descripción</th>
                <th>Categoría</th>
                <th style={{ textAlign: "right" }}>Precio (COP)</th>
                <th style={{ textAlign: "center" }}>Rinde</th>
                <th style={{ textAlign: "center" }}>Disponibilidad</th>
                <th style={{ textAlign: "center" }}>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32 }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid var(--color-border)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ marginTop: 8, color: "var(--color-text-secondary)", fontSize: 13 }}>Cargando catálogo...</p>
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 36, color: "var(--color-text-secondary)" }}>
                    No se encontraron productos registrados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                result.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--color-surface-secondary)",
                          border: "1px solid var(--color-border)",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {item.image_reference ? (
                          <img
                            src={mediaUrl(item.image_reference)}
                            alt={item.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon size={20} color="var(--color-text-muted)" />
                        )}
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {item.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "monospace",
                              backgroundColor: "var(--color-surface-secondary)",
                              padding: "2px 5px",
                              borderRadius: 4,
                              color: "var(--color-text-secondary)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {item.internal_code}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginTop: 2,
                          }}
                        >
                          {item.description}
                        </p>
                      </div>
                    </td>

                    <td>
                      <span
                        className="badge badge-neutral"
                        style={{ backgroundColor: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}
                      >
                        {item.category?.name ?? "General"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {formatCOP(item.current_price)}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)", display: "block", fontFamily: "monospace" }}>
                        v{item.price_version}
                      </span>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        <Users size={13} color="var(--color-text-muted)" />
                        {item.recommended_people ?? 1} p.
                      </span>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {item.is_available ? (
                        <span className="badge badge-success">
                          <span className="badge-dot" />
                          Disponible
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <span className="badge-dot" />
                          Agotado temp.
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {item.is_active ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-neutral">Inactivo</span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        {hasPermission("product.update") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditing(item)}
                            title="Editar información del producto"
                            style={{ padding: "0 8px" }}
                          >
                            <Edit2 size={13} />
                          </button>
                        )}

                        {hasPermission("product.change_price") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openPrice(item)}
                            title="Historial y cambio de precio"
                            style={{ padding: "0 8px" }}
                          >
                            <DollarSign size={13} />
                          </button>
                        )}

                        {hasPermission("product.change_availability") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  catalogApi.mutate(
                                    token,
                                    `products/${item.id}/availability`,
                                    { is_available: !item.is_available },
                                  ),
                                item.is_available
                                  ? "Producto marcado como agotado."
                                  : "Producto marcado como disponible.",
                              )
                            }
                            title={
                              item.is_available
                                ? "Marcar como agotado"
                                : "Marcar como disponible"
                            }
                            style={{ padding: "0 8px" }}
                          >
                            {item.is_available ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}

                        {hasPermission("product.disable") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  catalogApi.mutate(
                                    token,
                                    `products/${item.id}/${item.is_active ? "deactivate" : "activate"}`,
                                  ),
                                item.is_active
                                  ? "Producto retirado del catálogo."
                                  : "Producto activado en el catálogo.",
                              )
                            }
                            title={item.is_active ? "Desactivar plato" : "Activar plato"}
                            style={{ padding: "0 8px" }}
                          >
                            <Power size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Página <strong>{page}</strong> de {Math.max(1, Math.ceil(result.total / 25))} (
            {result.total} productos en total)
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page * 25 >= result.total || loading}
              onClick={() => setPage(page + 1)}
            >
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DRAWER LATERAL STITCH: CREAR / EDITAR PRODUCTO               */}
      {/* ============================================================ */}
      <Drawer
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo producto" : "Editar producto"}
        subtitle={
          editing === "new"
            ? "Ingresa la información para catalogar un nuevo ítem del restaurante."
            : "Modifica la información, fotografía, precio o estado del producto."
        }
        badge={
          editing && editing !== "new" ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                backgroundColor: "var(--color-surface-container)",
                color: "var(--color-text-secondary)",
              }}
            >
              ID: {editing.id}
            </span>
          ) : undefined
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-product-drawer"
              className="btn btn-primary btn-sm"
              disabled={busy}
            >
              <Check size={16} />
              <span>{editing === "new" ? "Crear producto" : "Guardar cambios"}</span>
            </button>
          </>
        }
      >
        <form
          id="form-product-drawer"
          onSubmit={saveProduct}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* SECCIÓN 1: FOTOGRAFÍA DEL PRODUCTO (STITCH) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
              Fotografía del producto
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-surface-secondary)",
                  border: "1px solid var(--color-border-strong)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <ImageIcon size={32} color="var(--color-text-muted)" />
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} />
                    <span>{imagePreview ? "Cambiar imagen" : "Subir imagen"}</span>
                  </button>
                  {imagePreview && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearImage}
                      style={{ color: "var(--color-secondary)" }}
                    >
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  JPG, PNG o WebP, máx. 5MB. Proporción 1:1 recomendada.
                </span>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />

          {/* SECCIÓN 2: INFORMACIÓN GENERAL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-secondary)" }}>
              Información General
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Código / SKU *</label>
                <div style={{ position: "relative" }}>
                  <input
                    required
                    maxLength={80}
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="HAM-001"
                    className="form-input"
                    readOnly={editing !== "new"}
                    style={{
                      fontFamily: "monospace",
                      backgroundColor: editing !== "new" ? "var(--color-surface-secondary)" : undefined,
                      paddingRight: editing !== "new" ? 32 : undefined,
                    }}
                  />
                  {editing !== "new" && (
                    <Lock
                      size={14}
                      color="var(--color-text-muted)"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
                    />
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nombre del producto *</label>
                <input
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Hamburguesa Especial"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Descripción completa</label>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  {description.length} / 300
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Carne artesanal, queso mozzarella, tocineta ahumada en pan brioche sellado..."
                className="form-input"
                style={{ resize: "none" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Categoría *</label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}
                  >
                    + Nueva
                  </button>
                </div>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="form-select"
                >
                  <option value="" disabled>Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.is_active && c.id !== categoryId}>
                      {c.name} {!c.is_active ? "(inactiva)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Precio venta (COP) *</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="22000"
                  className="form-input"
                  style={{ fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rinde para</label>
                <select
                  value={serves}
                  onChange={(e) => setServes(Number(e.target.value))}
                  className="form-select"
                >
                  <option value={1}>1 persona</option>
                  <option value={2}>2 personas</option>
                  <option value={3}>3-4 personas</option>
                  <option value={5}>Familiar (5+)</option>
                </select>
              </div>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />

          {/* SECCIÓN 3: ESTADO Y DISPONIBILIDAD OPERATIVA (STITCH) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-secondary)" }}>
              Estado y Disponibilidad
            </h3>

            <div
              style={{
                backgroundColor: "var(--color-surface-secondary)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                border: "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Switch 1: Producto activo */}
              <label style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block" }}>
                    Producto activo en catálogo
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginTop: 2 }}>
                    Determina si el producto existe oficialmente en el menú administrativo de POTOQUITOS.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, cursor: "pointer" }}
                />
              </label>

              <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />

              {/* Switch 2: Disponible para venta */}
              <label style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block" }}>
                    Disponible para venta inmediata
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginTop: 2 }}>
                    Habilita este producto para ser seleccionado en pedidos del salón y visible en el menú público.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, cursor: "pointer" }}
                />
              </label>
            </div>

            {/* Aviso Stitch */}
            <div
              style={{
                backgroundColor: "var(--color-primary-soft)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                border: "1px solid var(--color-primary-dark)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: "var(--color-primary)" }}>Regla operativa:</strong> Un producto puede estar <strong>Activo</strong> pero <strong>No disponible</strong> temporalmente por falta de existencias en cocina.
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />

          {/* SECCIÓN 4: RECETA E INVENTARIO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-secondary)" }}>
                Receta e Inventario
              </h3>
              <span className="badge badge-success" style={{ fontSize: 11 }}>
                <span className="badge-dot" /> Kardex activo
              </span>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                border: "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                La receta descuenta automáticamente los ingredientes del inventario al confirmarse cada orden en cocina.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <Link
                  to="/inventory"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11 }}
                >
                  <Soup size={13} />
                  <span>Gestionar receta en Inventario</span>
                </Link>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  Consumo automatizado
                </span>
              </div>
            </div>
          </div>
        </form>
      </Drawer>

      {/* ============================================================ */}
      {/* DRAWER LATERAL STITCH: GESTIÓN DE CATEGORÍAS                 */}
      {/* ============================================================ */}
      <Drawer
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditCategory(null);
        }}
        title="Gestionar categorías"
        subtitle="Organiza los grupos de productos visibles en cocina, comandas y menú público."
        width="md"
        footer={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowCategoryModal(false);
              setEditCategory(null);
            }}
          >
            Cerrar
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              Total: <strong>{categories.length} categorías registradas</strong>
            </span>
            {hasPermission("category.create") && !editCategory && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditCategory("new")}
              >
                <Plus size={14} />
                <span>Nueva categoría</span>
              </button>
            )}
          </div>

          {/* Formulario Crear / Editar Categoría */}
          {editCategory && (
            <form
              key={currentCategory?.id ?? "new-category"}
              onSubmit={saveCategory}
              style={{
                backgroundColor: "var(--color-surface-secondary)",
                padding: 16,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                {currentCategory ? "Editar Categoría" : "Nueva Categoría"}
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={currentCategory?.name}
                    className="form-input"
                    placeholder="Ej. Hamburguesas"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Orden *</label>
                  <input
                    name="display_order"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={currentCategory?.display_order ?? 0}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción opcional</label>
                <input
                  name="description"
                  defaultValue={currentCategory?.description ?? ""}
                  className="form-input"
                  placeholder="Descripción de la categoría"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditCategory(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                >
                  Guardar
                </button>
              </div>
            </form>
          )}

          {/* Tabla de Categorías */}
          <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {item.display_order}
                    </td>
                    <td>
                      <strong style={{ display: "block" }}>{item.name}</strong>
                      {item.description && (
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {item.is_active ? (
                        <span className="badge badge-success">Activa</span>
                      ) : (
                        <span className="badge badge-neutral">Inactiva</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {hasPermission("category.update") && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditCategory(item)}
                            style={{ padding: "0 8px" }}
                            title="Editar categoría"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {hasPermission(
                          item.is_active ? "category.disable" : "category.update",
                        ) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={async () => {
                              await action(async () => {
                                await catalogApi.mutate(
                                  token,
                                  `categories/${item.id}/${item.is_active ? "deactivate" : "activate"}`,
                                  {},
                                  "POST",
                                );
                                const updated = await catalogApi.categories(token);
                                setCategories(updated);
                              }, item.is_active ? "Categoría inactivada." : "Categoría activada.");
                            }}
                            style={{ padding: "0 8px" }}
                            title={item.is_active ? "Inactivar" : "Activar"}
                          >
                            <Power size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Drawer>

      {/* ============================================================ */}
      {/* MODAL: PRECIO E HISTORIAL AUDITADO                           */}
      {/* ============================================================ */}
      {pricing && (
        <div className="modal-overlay" onClick={() => setPricing(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HistoryIcon size={20} color="var(--color-primary)" />
                <div>
                  <h2 className="modal-title">Control de Precio e Historial</h2>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {pricing.name} ({pricing.internal_code})
                  </span>
                </div>
              </div>
              <button onClick={() => setPricing(null)} style={{ color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            {/* Current Price Box */}
            <div
              style={{
                backgroundColor: "var(--color-primary-soft)",
                borderRadius: "var(--radius-md)",
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
                  PRECIO VIGENTE
                </span>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)" }}>
                  {formatCOP(pricing.current_price)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    backgroundColor: "var(--color-surface)",
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Versión actual: {pricing.price_version}
                </span>
              </div>
            </div>

            {/* Change Price Form */}
            {hasPermission("product.change_price") && (
              <form
                onSubmit={savePrice}
                style={{
                  backgroundColor: "var(--color-surface-secondary)",
                  padding: 14,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  marginBottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div className="form-group">
                  <label className="form-label">Nuevo Precio de Venta (COP)</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      required
                      type="number"
                      min="0"
                      max="9999999999.99"
                      step=".01"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      className="form-input"
                      placeholder="0.00"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                    >
                      Actualizar Precio
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* History Table */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Auditoría de Modificaciones
              </h3>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {history.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", padding: 12 }}>
                    No hay cambios registrados previos.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Anterior</th>
                        <th>Nuevo</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td style={{ fontSize: 11 }}>
                            {new Date(h.changed_at).toLocaleString("es-CO")}
                          </td>
                          <td style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                            {h.previous_price === null ? "Inicial" : formatCOP(h.previous_price)}
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: "var(--color-tertiary)" }}>
                            {formatCOP(h.new_price)}
                          </td>
                          <td style={{ fontSize: 11 }}>Usuario #{h.changed_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPricing(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
