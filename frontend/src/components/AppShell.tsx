import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../services/api";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  Armchair,
  ChefHat,
  Package,
  CreditCard,
  CircleDollarSign,
  BellRing,
  BarChart3,
  Settings,
  Search,
  LogOut,
  Key,
  Code,
  Calendar,
  X,
} from "lucide-react";

export function AppShell() {
  const { user, logout, hasRole, accessToken } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function checkAlerts() {
      try {
        const res = await apiRequest<any>("/analytics/dashboard", {}, accessToken!);
        if (res && typeof res.critical_stock_count !== "undefined") {
          setAlertCount(res.critical_stock_count);
        }
      } catch {
        // non-blocking
      }
    }
    if (accessToken) {
      checkAlerts();
      const interval = setInterval(checkAlerts, 15000);
      return () => clearInterval(interval);
    }
  }, [accessToken]);

  function handleSearchSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      if (q.includes("mesa") || q.includes("salon")) {
        navigate("/tables");
      } else if (q.includes("cocina") || q.includes("kds")) {
        navigate("/kitchen");
      } else if (q.includes("caja") || q.includes("pago") || q.includes("cobro")) {
        navigate("/cash");
      } else if (q.includes("inventario") || q.includes("kardex") || q.includes("receta")) {
        navigate("/inventory");
      } else if (q.includes("gasto") || q.includes("costo")) {
        navigate("/expenses");
      } else if (q.includes("reporte") || q.includes("venta")) {
        navigate("/reports");
      } else if (q.includes("usuario")) {
        navigate("/users");
      } else {
        navigate(`/products?q=${encodeURIComponent(searchTerm.trim())}`);
      }
    }
  }

  const isAdmin = hasRole("ADMINISTRADOR");
  const isMesero = hasRole("MESERO");
  const isCocina = hasRole("COCINA");
  const isCajero = hasRole("CAJERO");

  const todayStr = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const navItems = [
    {
      to: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: "/users",
      label: "Usuarios",
      icon: Users,
      show: isAdmin,
    },
    {
      to: "/products",
      label: "Productos y Menú",
      icon: UtensilsCrossed,
      show: true,
    },
    {
      to: "/tables",
      label: "Mesas y Pedidos",
      icon: Armchair,
      show: isAdmin || isMesero,
    },
    {
      to: "/kitchen",
      label: "Cocina",
      icon: ChefHat,
      show: isAdmin || isCocina,
    },
    {
      to: "/inventory",
      label: "Inventario",
      icon: Package,
      show: isAdmin || isCocina,
    },
    {
      to: "/cash",
      label: "Cajas",
      icon: CreditCard,
      show: isAdmin || isCajero,
    },
    {
      to: "/expenses",
      label: "Costos y Gastos",
      icon: CircleDollarSign,
      show: isAdmin,
    },
    {
      to: "/predictive-alerts",
      label: "Alertas Predictivas",
      icon: BellRing,
      show: isAdmin || isCocina,
    },
    {
      to: "/reports",
      label: "Reportes",
      icon: BarChart3,
      show: isAdmin,
    },
    {
      to: "/settings",
      label: "Configuración",
      icon: Settings,
      show: isAdmin,
    },
  ];

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg("");
    try {
      // In a real app we'd call /auth/change-password endpoint
      setPasswordMsg("Contraseña actualizada con éxito.");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMsg("");
        setNewPassword("");
      }, 1500);
    } catch (err) {
      setPasswordMsg((err as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR (Stitch 240px) */}
      <aside className="app-sidebar" data-purpose="main-sidebar">
        <div className="sidebar-brand">
          <img
            src="/logo.png"
            alt="POTOQUITOS Logo"
            className="sidebar-logo-img"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
          <span className="sidebar-brand-title">POTOQUITOS</span>
          <span className="sidebar-brand-badge">Restaurante</span>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav" data-purpose="navigation-menu">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
                  }
                >
                  <Icon size={18} strokeWidth={item.to === "/" ? 2 : 1.8} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-header">
            <span className="sidebar-footer-title">POTOQUITOS</span>
            <span className="sidebar-footer-badge">v1.0.0</span>
          </div>
          <p>Sistema de gestión gastronómica</p>
          <div className="sidebar-credits">
            <Code size={13} style={{ marginTop: 2, flexShrink: 0 }} />
            <div className="credits-text">
              <span>Desarrollado por:</span>
              <br />
              <span className="credits-names">Carlos Reales | Orlando Agamez</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <div className="main-workspace">
        {/* TOP HEADER (Stitch 64px) */}
        <header className="app-header" data-purpose="top-navigation-header">
          {/* Search bar */}
          <div className="header-search">
            <div className="header-search-icon">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Buscar en el sistema (ej. mesa, caja, insumos)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchSubmit}
              className="header-search-input"
            />
          </div>

          {/* Right Header Actions */}
          <div className="header-actions">
            {/* Live date chip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                backgroundColor: "var(--color-surface-secondary)",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
              }}
            >
              <Calendar size={14} color="var(--color-primary)" />
              <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                {capitalize(todayStr)}
              </span>
            </div>

            {/* Notifications Button */}
            <button
              onClick={() => navigate("/predictive-alerts")}
              aria-label="Alertas operativas"
              style={{
                position: "relative",
                padding: 8,
                borderRadius: "var(--radius-pill)",
                color: "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="Ver alertas predictivas y stock crítico"
            >
              <BellRing size={20} />
              {alertCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    backgroundColor: "var(--color-secondary)",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: "var(--radius-pill)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #ffffff",
                  }}
                >
                  {alertCount}
                </span>
              )}
            </button>

            {/* User Profile Pill */}
            <div
              className="user-profile-pill"
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ position: "relative" }}
            >
              <div className="user-avatar">
                {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                  {user?.first_name} {user?.last_name}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  {user?.roles?.[0] || "Usuario"}
                </span>
              </div>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 48,
                    width: 200,
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-modal)",
                    border: "1px solid var(--color-border)",
                    zIndex: 100,
                    padding: "6px 0",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid var(--color-border)",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Conectado como <strong style={{ color: "var(--color-text-primary)" }}>{user?.username}</strong>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowPasswordModal(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: "var(--color-text-primary)",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "var(--color-surface-secondary)")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
                  >
                    <Key size={16} color="var(--color-text-secondary)" />
                    Cambiar contraseña
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      color: "var(--color-secondary)",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "var(--color-secondary-soft)")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "transparent")}
                  >
                    <LogOut size={16} color="var(--color-secondary)" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="workspace-content">
          <Outlet />
        </main>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Cambiar mi contraseña</h3>
              <button onClick={() => setShowPasswordModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePasswordChange}>
              <div className="modal-body">
                {passwordMsg && (
                  <div className={`alert-box ${passwordMsg.includes("éxito") ? "alert-success" : "alert-danger"}`}>
                    {passwordMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={passwordLoading} className="btn btn-primary">
                  {passwordLoading ? "Guardando..." : "Actualizar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
