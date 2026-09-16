import React, { useEffect, useState } from "react";
import { fetchPublicMenu, type PublicCategory, type PublicProduct } from "../catalogApi";
import { formatCOP, mediaUrl } from "../../../config/env";
import {
  Search,
  BookOpen,
  BellRing,
  UtensilsCrossed,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";

export function PublicMenuPage() {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublicMenu()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const allProducts: (PublicProduct & { categoryName: string })[] = [];
  categories.forEach((c) => {
    c.products.forEach((p) => {
      allProducts.push({ ...p, categoryName: c.name });
    });
  });

  const filteredProducts = allProducts.filter((p) => {
    if (selectedCat !== null && p.categoryName !== selectedCat) return false;
    if (
      search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.description.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
      {/* STICKY HEADER (Stitch men_p_blico_potoquitos) */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 20px",
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* Brand Logo Oficial */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.png"
              alt="POTOQUITOS Restaurante"
              style={{ width: 44, height: 44, objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text-primary)", display: "block", lineHeight: 1.1 }}>
                POTOQUITOS
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Restaurante
              </span>
            </div>
          </div>

          {/* Indicator center */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              backgroundColor: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--color-border)",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            <BookOpen size={15} color="var(--color-primary)" />
            <span style={{ fontWeight: 500 }}>Menú Digital para Comensales</span>
          </div>

          {/* Status right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              backgroundColor: "var(--color-tertiary-soft)",
              color: "var(--color-tertiary)",
              borderRadius: "var(--radius-pill)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--color-tertiary)" }} />
            <span>Abierto hoy • 12:00 PM - 10:30 PM</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: 1120, width: "100%", margin: "0 auto", padding: "28px 20px 60px", flex: 1 }}>
        {/* BANNER GASTRO */}
        <section style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--color-primary)", letterSpacing: "0.05em", marginBottom: 4 }}>
                <UtensilsCrossed size={14} />
                <span>Carta Gastronómica</span>
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                Nuestro Menú
              </h1>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginTop: 4 }}>
                Explora los platos artesanales, combos y bebidas preparados en POTOQUITOS.
              </p>
            </div>

            {/* Service note */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <BellRing size={16} color="var(--color-secondary)" />
              <span>Los pedidos son atendidos y confirmados en tu mesa por nuestro equipo de meseros.</span>
            </div>
          </div>
        </section>

        {/* SEARCH & CATEGORY PILLS */}
        <section style={{ position: "sticky", top: 70, zIndex: 20, backgroundColor: "var(--color-bg)", padding: "10px 0 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Buscar por nombre o ingredientes (ej. hamburguesa, queso, tocineta)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 40, height: 44, borderRadius: "var(--radius-pill)", boxShadow: "var(--shadow-card)" }}
              />
            </div>

            {/* Category Pills */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              <button
                onClick={() => setSelectedCat(null)}
                className={`badge ${selectedCat === null ? "badge-info" : "badge-neutral"}`}
                style={{ cursor: "pointer", height: 34, padding: "0 16px", fontSize: 13 }}
              >
                Todos ({allProducts.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSelectedCat(c.name)}
                  className={`badge ${selectedCat === c.name ? "badge-info" : "badge-neutral"}`}
                  style={{ cursor: "pointer", height: 34, padding: "0 16px", fontSize: 13 }}
                >
                  {c.name} ({c.products.length})
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCTS GRID (Stitch men_p_blico_potoquitos cards) */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
            <p>Cargando carta de POTOQUITOS...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
            <UtensilsCrossed size={48} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <h3>No se encontraron platos</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>Prueba con otro término de búsqueda o selecciona otra categoría.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {filteredProducts.map((product, idx) => (
              <div
                key={idx}
                className="card"
                style={{
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {product.image_reference ? (
                      <img
                        src={mediaUrl(product.image_reference)}
                        alt={product.name}
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: "var(--radius-md)",
                          objectFit: "cover",
                          flexShrink: 0,
                          backgroundColor: "var(--color-surface-container)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: "var(--radius-md)",
                          backgroundColor: "var(--color-surface-container)",
                          color: "var(--color-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <UtensilsCrossed size={32} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>
                        {product.categoryName}
                      </span>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 2, lineHeight: 1.2 }}>
                        {product.name}
                      </h3>
                      {product.recommended_people && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color: "var(--color-text-muted)" }}>
                          <Users size={12} />
                          <span>Para {product.recommended_people} {product.recommended_people === 1 ? "persona" : "personas"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 12, lineHeight: 1.4 }}>
                    {product.description}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                    {formatCOP(product.current_price)}
                  </span>
                  <span className="badge badge-success">
                    <span className="badge-dot" /> Disponible
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Restaurante POTOQUITOS • Carta Digital • Desarrollado por Carlos Reales | Orlando Agamez
        </p>
      </footer>
    </div>
  );
}
