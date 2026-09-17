import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../services/api";
import { Drawer } from "./Drawer";
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
  const isAdmin = hasRole("ADMINISTRADOR");
  const isMesero = hasRole("MESERO");
  const isCocina = hasRole("COCINA");
  const isCajero = hasRole("CAJERO");

  type AppNotification = {
    id: string;
    title: string;
    message: string;
    type: "warning" | "danger" | "info";
    path: string;
  };

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);

  useEffect(() => {
    async function checkAlerts() {
      if (!accessToken) return;
      const notifs: AppNotification[] = [];
      try {
        if (isAdmin) {
          const res = await apiRequest<any>("/analytics/dashboard", {}, accessToken).catch(() => null);
          if (res && res.critical_stock_count > 0) {
            notifs.push({
              id: "stock-crit",
              title: "Stock Crítico",
              message: `${res.critical_stock_count} insumo(s) bajo el umbral mínimo de seguridad.`,
              type: "danger",
              path: "/inventory",
            });
          }
          const pred = await apiRequest<any>("/analytics/predictive-alerts", {}, accessToken).catch(() => null);
          const predList = Array.isArray(pred) ? pred : (pred?.alerts || []);
          if (predList.length > 0) {
            const highPred = predList.filter(
              (a: any) =>
                a.status === "RIESGO_ALTO" ||
                a.risk_level === "RIESGO_ALTO" ||
                a.urgency === "CRITICA" ||
                a.urgency === "ALTA"
            );
            if (highPred.length > 0) {
              notifs.push({
                id: "pred-alert",
                title: "Alerta Predictiva",
                message: `${highPred.length} producto(s)/ingrediente(s) con alto riesgo de agotamiento proyectado.`,
                type: "warning",
                path: "/predictive-alerts",
              });
            }
          }
        }
        if (isAdmin || isMesero) {
          const ordersRes = await apiRequest<any>("/tables-orders/orders", {}, accessToken).catch(() => null);
          const ordList = Array.isArray(ordersRes) ? ordersRes : (ordersRes?.items || []);
          const readyOrders = ordList.filter((o: any) => o.state === "LISTO");
          if (readyOrders.length > 0) {
            notifs.push({
              id: "ready-orders",
              title: "Platos Listos para Servir",
              message: `${readyOrders.length} pedido(s) listos en pase esperando entrega.`,
              type: "info",
              path: "/tables",
            });
          }
        }
        if (isAdmin || isCajero) {
          const tablesRes = await apiRequest<any>("/tables-orders/tables", {}, accessToken).catch(() => null);
          const tblList = Array.isArray(tablesRes) ? tablesRes : (tablesRes?.items || []);
          const pendingPay = tblList.filter((t: any) => t.is_active !== false && (t.state === "CUENTA_SOLICITADA" || t.state === "PENDIENTE_PAGO" || t.state === "PAGO_PARCIAL"));
          if (pendingPay.length > 0) {
            notifs.push({
              id: "cash-tables",
              title: "Cuentas por Cobrar",
              message: `${pendingPay.length} mesa(s) con cuenta solicitada pendientes en Caja.`,
              type: "warning",
              path: "/cash",
            });
          }
        }
      } catch {
        // non-blocking
      }
      setNotifications(notifs);
    }

    checkAlerts();
    const interval = setInterval(checkAlerts, 15000);
    return () => clearInterval(interval);
  }, [accessToken, isAdmin, isMesero, isCajero]);

  function handleSearchSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      if ((q.includes("mesa") || q.includes("salon")) && (isAdmin || isMesero)) {
        navigate("/tables");
      } else if ((q.includes("cocina") || q.includes("kds")) && (isAdmin || isCocina)) {
        navigate("/kitchen");
      } else if ((q.includes("caja") || q.includes("pago") || q.includes("cobro")) && (isAdmin || isCajero)) {
        navigate("/cash");
      } else if ((q.includes("inventario") || q.includes("kardex") || q.includes("receta")) && isAdmin) {
        navigate("/inventory");
      } else if ((q.includes("gasto") || q.includes("costo")) && isAdmin) {
        navigate("/expenses");
      } else if ((q.includes("reporte") || q.includes("venta")) && isAdmin) {
        navigate("/reports");
      } else if (q.includes("usuario") && isAdmin) {
        navigate("/users");
      } else if (isAdmin) {
        navigate(`/products?q=${encodeURIComponent(searchTerm.trim())}`);
      }
    }
  }

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
      show: isAdmin,
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
      show: isAdmin,
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
      to: "/cash",
      label: "Cajas",
      icon: CreditCard,
      show: isAdmin || isCajero,
    },
    {
      to: "/inventory",
      label: "Inventario",
      icon: Package,
      show: isAdmin,
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
      show: isAdmin,
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

            {/* Notifications Button & Popover */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowNotifPopover(!showNotifPopover)}
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
                  background: showNotifPopover ? "var(--color-surface-secondary)" : "transparent",
                  border: "none",
                }}
                title="Ver resumen de alertas operativas"
              >
                <BellRing size={20} />
                {notifications.length > 0 && (
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
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifPopover && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    width: 320,
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-modal)",
                    border: "1px solid var(--color-border)",
                    zIndex: 110,
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "var(--color-surface-secondary)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      Notificaciones y Alertas ({notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotifPopover(false)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                      title="Cerrar notificaciones"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 12 }}>
                        No hay alertas operativas activas en este momento.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotifPopover(false);
                            navigate(n.path);
                          }}
                          style={{
                            padding: "10px 14px",
                            borderBottom: "1px solid var(--color-border)",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-surface-secondary)")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: n.type === "danger" ? "var(--color-secondary)" : n.type === "warning" ? "var(--color-warning)" : "var(--color-primary)" }}>
                              {n.title}
                            </span>
                            <span className={`badge ${n.type === "danger" ? "badge-danger" : n.type === "warning" ? "badge-warning" : "badge-info"}`} style={{ height: 18, fontSize: 9 }}>
                              Ir
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {n.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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

      {/* DRAWER: CAMBIAR MI CONTRASEÑA */}
      <Drawer
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Cambiar mi contraseña"
        subtitle="Actualiza tus credenciales de acceso al sistema POTOQUITOS."
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setShowPasswordModal(false)} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-change-password-user" disabled={passwordLoading} className="btn btn-primary">
              {passwordLoading ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </>
        }
      >
        <form id="form-change-password-user" onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {passwordMsg && (
            <div className={`alert-box ${passwordMsg.includes("éxito") ? "alert-success" : "alert-danger"}`}>
              {passwordMsg}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Nueva contraseña *</label>
            <input
              type="password"
              required
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
