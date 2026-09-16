import React, { useEffect, useState, type FormEvent } from "react";
import { useAuth, type AuthUser } from "../../contexts/AuthContext";
import { apiRequest } from "../../services/api";
import { Drawer } from "../../components/Drawer";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Key,
  Edit,
  Shield,
  CheckCircle2,
  XCircle,
  X,
  Lock,
  Check,
  Power,
  AtSign,
} from "lucide-react";

type Role = { id: number; name: string };

export function UsersPage() {
  const { accessToken, hasPermission, user: currentUser } = useAuth();
  const token = accessToken!;

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Drawer Create / Edit State
  const [drawerUser, setDrawerUser] = useState<AuthUser | "new" | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MESERO");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick Password Reset Modal
  const [passwordTargetUser, setPasswordTargetUser] = useState<AuthUser | null>(null);
  const [targetPassword, setTargetPassword] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      const [uRes, rRes] = await Promise.all([
        apiRequest<AuthUser[]>("/users", {}, token),
        apiRequest<Role[]>("/roles", {}, token).catch(() => []),
      ]);
      setUsers(uRes);
      setRoles(rRes);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function openCreateDrawer() {
    setDrawerUser("new");
    setFirstName("");
    setLastName("");
    setUsername("");
    setEmail("");
    setRole("MESERO");
    setIsActive(true);
    setPassword("");
    setConfirmPassword("");
  }

  function openEditDrawer(user: AuthUser) {
    setDrawerUser(user);
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setUsername(user.username);
    setEmail(user.email);
    setRole(user.roles?.[0] || "MESERO");
    setIsActive(user.is_active);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSaveUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (drawerUser === "new") {
        if (!password || password.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres.");
        }
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden.");
        }
        await apiRequest(
          "/users",
          {
            method: "POST",
            body: JSON.stringify({
              username: username.trim(),
              email: email.trim(),
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              password,
              roles: [role],
              is_active: isActive,
            }),
          },
          token,
        );
        setMessage("Usuario creado exitosamente.");
      } else {
        if (!drawerUser) return;
        await apiRequest(
          `/users/${drawerUser.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim(),
              is_active: isActive,
              roles: [role],
            }),
          },
          token,
        );

        if (password) {
          if (password.length < 8) {
            throw new Error("La contraseña debe tener al menos 8 caracteres.");
          }
          if (password !== confirmPassword) {
            throw new Error("Las contraseñas no coinciden.");
          }
          await apiRequest(
            `/users/${drawerUser.id}/change-password`,
            {
              method: "POST",
              body: JSON.stringify({ new_password: password }),
            },
            token,
          );
        }
        setMessage("Usuario actualizado exitosamente.");
      }

      setDrawerUser(null);
      await loadData();
      setTimeout(() => setMessage(""), 3500);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user: AuthUser) {
    try {
      const endpoint = user.is_active
        ? `/users/${user.id}/deactivate`
        : `/users/${user.id}/activate`;
      await apiRequest(endpoint, { method: "POST" }, token);
      await loadData();
      setMessage(
        user.is_active
          ? `Usuario ${user.username} inactivado.`
          : `Usuario ${user.username} activado.`,
      );
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function handleChangePasswordAdmin(e: FormEvent) {
    e.preventDefault();
    if (!passwordTargetUser) return;
    try {
      if (targetPassword.length < 8) {
        throw new Error("La contraseña debe tener al menos 8 caracteres.");
      }
      await apiRequest(
        `/users/${passwordTargetUser.id}/change-password`,
        {
          method: "POST",
          body: JSON.stringify({ new_password: targetPassword }),
        },
        token,
      );
      setPasswordTargetUser(null);
      setTargetPassword("");
      setMessage("Contraseña actualizada correctamente.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case "ADMINISTRADOR":
        return <span className="badge badge-primary">Administrador</span>;
      case "MESERO":
        return <span className="badge badge-info">Mesero</span>;
      case "COCINA":
        return <span className="badge badge-warning">Cocina</span>;
      case "CAJERO":
        return <span className="badge badge-tertiary">Cajero</span>;
      default:
        return <span className="badge badge-neutral">{roleName || "Sin rol"}</span>;
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    const matchesSearch =
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(term);
    const matchesRole = roleFilter
      ? u.roles?.includes(roleFilter)
      : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. HEADER & ACTIONS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Gestión de Usuarios y Roles
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Administra el personal del restaurante, accesos y permisos por perfil operativo.
          </p>
        </div>

        {hasPermission("user.create") && (
          <button onClick={openCreateDrawer} className="btn btn-primary btn-sm">
            <UserPlus size={16} />
            <span>Nuevo usuario</span>
          </button>
        )}
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div
          className={`alert-box ${message.toLowerCase().includes("exitosamente") || message.toLowerCase().includes("activado") ? "alert-success" : "alert-danger"}`}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ color: "inherit" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. STATS OVERVIEW CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">TOTAL USUARIOS</div>
            <div className="kpi-value">{users.length}</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Colaboradores registrados</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
            <Users size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">ACTIVOS</div>
            <div className="kpi-value" style={{ color: "var(--color-tertiary)" }}>
              {users.filter((u) => u.is_active).length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Habilitados para ingresar</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-tertiary-soft)", color: "var(--color-tertiary)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">INACTIVOS</div>
            <div className="kpi-value" style={{ color: "var(--color-text-muted)" }}>
              {users.filter((u) => !u.is_active).length}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Acceso revocado</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-neutral-soft)", color: "var(--color-text-muted)" }}>
            <XCircle size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">ROLES DEFINIDOS</div>
            <div className="kpi-value" style={{ color: "var(--color-primary)" }}>4</div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Admin, Mesero, Cocina, Cajero</span>
          </div>
          <div className="kpi-icon-box" style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
            <Shield size={22} />
          </div>
        </div>
      </div>

      {/* 3. FILTERS BAR */}
      <div className="filter-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search
            size={16}
            color="var(--color-text-muted)"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="Buscar usuario por nombre, usuario o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="form-select"
          style={{ width: "auto", minWidth: 170 }}
        >
          <option value="">Todos los Roles</option>
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="MESERO">Mesero</option>
          <option value="COCINA">Cocina</option>
          <option value="CAJERO">Cajero</option>
        </select>
      </div>

      {/* 4. USERS TABLE */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Usuario (Login ID)</th>
                <th>Correo Electrónico</th>
                <th>Rol Asignado</th>
                <th style={{ textAlign: "center" }}>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32 }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid var(--color-border)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ marginTop: 8, color: "var(--color-text-secondary)", fontSize: 13 }}>Cargando usuarios...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--color-text-secondary)" }}>
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            backgroundColor: "var(--color-primary-soft)",
                            color: "var(--color-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {u.first_name?.[0] || u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: "block", color: "var(--color-text-primary)" }}>
                            {u.first_name} {u.last_name}
                          </strong>
                          {currentUser?.id === u.id && (
                            <span style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700 }}>
                              (Tu sesión)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontFamily: "monospace", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                        @{u.username}
                      </span>
                    </td>

                    <td style={{ color: "var(--color-text-secondary)" }}>{u.email}</td>

                    <td>{getRoleBadge(u.roles?.[0])}</td>

                    <td style={{ textAlign: "center" }}>
                      {u.is_active ? (
                        <span className="badge badge-success">
                          <span className="badge-dot" /> Activo
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          <span className="badge-dot" /> Inactivo
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {hasPermission("user.update") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditDrawer(u)}
                            title="Editar usuario y rol"
                            style={{ padding: "0 8px" }}
                          >
                            <Edit size={13} />
                          </button>
                        )}

                        {hasPermission("user.update") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setPasswordTargetUser(u);
                              setTargetPassword("");
                            }}
                            title="Restablecer contraseña"
                            style={{ padding: "0 8px" }}
                          >
                            <Key size={13} />
                          </button>
                        )}

                        {hasPermission("user.update") && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleActive(u)}
                            title={u.is_active ? "Inactivar cuenta" : "Activar cuenta"}
                            style={{ padding: "0 8px" }}
                          >
                            <Power size={13} color={u.is_active ? "var(--color-secondary)" : "var(--color-tertiary)"} />
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
      </div>

      {/* ============================================================ */}
      {/* DRAWER LATERAL STITCH: CREAR / EDITAR USUARIO                */}
      {/* ============================================================ */}
      <Drawer
        isOpen={Boolean(drawerUser)}
        onClose={() => setDrawerUser(null)}
        title={drawerUser === "new" ? "Nuevo usuario" : "Editar usuario"}
        subtitle={
          drawerUser === "new"
            ? "Ingresa la información para habilitar una cuenta del personal de POTOQUITOS."
            : "Modifica los datos del colaborador, rol y permisos en el sistema."
        }
        width="md"
        badge={
          drawerUser && drawerUser !== "new" ? (
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
              ID: {drawerUser.id}
            </span>
          ) : undefined
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDrawerUser(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-user-drawer"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              <Check size={16} />
              <span>{drawerUser === "new" ? "Crear usuario" : "Guardar cambios"}</span>
            </button>
          </>
        }
      >
        <form
          id="form-user-drawer"
          onSubmit={handleSaveUser}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input
                type="text"
                required
                placeholder="Ej. Carlos"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input
                type="text"
                required
                placeholder="Ej. Reales"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre de usuario (Login ID) *</label>
            <div style={{ position: "relative" }}>
              <AtSign
                size={16}
                color="var(--color-text-muted)"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                required
                placeholder="ej. creales"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                readOnly={drawerUser !== "new"}
                style={{
                  paddingLeft: 32,
                  fontFamily: "monospace",
                  backgroundColor: drawerUser !== "new" ? "var(--color-surface-secondary)" : undefined,
                }}
              />
              {drawerUser !== "new" && (
                <Lock
                  size={14}
                  color="var(--color-text-muted)"
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
                />
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
              Será utilizado para iniciar sesión en los terminales del restaurante.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Correo electrónico *</label>
            <input
              type="email"
              required
              placeholder="usuario@potoquitos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Rol del sistema *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-select"
                required
              >
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="MESERO">Mesero</option>
                <option value="COCINA">Cocina</option>
                <option value="CAJERO">Cajero</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado de la cuenta</label>
              <select
                value={isActive ? "activo" : "inactivo"}
                onChange={(e) => setIsActive(e.target.value === "activo")}
                className="form-select"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--color-border)" }} />

          {/* CREDENCIALES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {drawerUser === "new" ? "Contraseña Temporal *" : "Actualizar Contraseña (Opcional)"}
            </h4>

            <div className="form-group">
              <label className="form-label">
                {drawerUser === "new" ? "Contraseña inicial *" : "Nueva contraseña"}
              </label>
              <input
                type="password"
                required={drawerUser === "new"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <input
                type="password"
                required={drawerUser === "new" || Boolean(password)}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              border: "1px solid var(--color-border)",
              fontSize: 11,
              color: "var(--color-text-secondary)",
              lineHeight: 1.4,
            }}
          >
            El usuario podrá actualizar sus credenciales directamente desde su perfil una vez inicie sesión.
          </div>
        </form>
      </Drawer>

      {/* QUICK RESET PASSWORD MODAL */}
      {passwordTargetUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPasswordTargetUser(null)}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              maxWidth: 400,
              width: "100%",
              boxShadow: "var(--shadow-modal)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Key size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Restablecer Contraseña</h3>
              </div>
              <button onClick={() => setPasswordTargetUser(null)} style={{ color: "var(--color-text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePasswordAdmin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                Asignar nueva contraseña para <strong>@{passwordTargetUser.username}</strong> ({passwordTargetUser.first_name} {passwordTargetUser.last_name}):
              </p>

              <div className="form-group">
                <label className="form-label">Nueva Contraseña *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={targetPassword}
                  onChange={(e) => setTargetPassword(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPasswordTargetUser(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
