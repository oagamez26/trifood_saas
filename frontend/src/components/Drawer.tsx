import React, { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  size,
  width = "md",
}: DrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const requestedSize = size || width;
  const sizeClass =
    requestedSize === "sm"
      ? "drawer-sm"
      : requestedSize === "lg"
      ? "drawer-lg"
      : requestedSize === "xl" || requestedSize === "2xl" || requestedSize === "full"
      ? "drawer-xl"
      : "drawer-md";

  return (
    <div className="drawer-root" style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      {/* BACKDROP OVERLAY */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          transition: "opacity 0.25s ease",
          zIndex: 1000,
        }}
        aria-hidden="true"
      />

      {/* SLIDE-OVER RIGHT PANEL */}
      <aside
        className={`drawer-panel ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* DRAWER HEADER */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "var(--color-surface-secondary, #f8fafc)",
            flexShrink: 0,
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
            overflowX: "hidden",
          }}
        >
          <div style={{ paddingRight: 12, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--color-text-primary, #0f172a)",
                  letterSpacing: "-0.015em",
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary, #64748b)",
                  marginTop: 4,
                  marginBottom: 0,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Cerrar panel"
            title="Cerrar panel"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-muted, #94a3b8)",
              backgroundColor: "transparent",
              cursor: "pointer",
              border: "none",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-border, #e2e8f0)";
              e.currentTarget.style.color = "var(--color-text-primary, #0f172a)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--color-text-muted, #94a3b8)";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* DRAWER SCROLLABLE BODY */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
          }}
          className="custom-scrollbar drawer-body"
        >
          {children}
        </div>

        {/* DRAWER FOOTER */}
        {footer && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--color-border, #e2e8f0)",
              backgroundColor: "var(--color-surface, #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: 10,
              flexShrink: 0,
              boxSizing: "border-box",
              width: "100%",
              maxWidth: "100%",
            }}
          >
            {footer}
          </div>
        )}
      </aside>

      <style>{`
        @keyframes drawerSlideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
