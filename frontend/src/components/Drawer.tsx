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
  width?: "md" | "lg" | "xl" | string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "lg",
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

  const widthStyle = width === "md" ? "480px" : width === "xl" ? "700px" : "620px";

  return (
    <div className="drawer-root" style={{ position: "fixed", inset: 0, zIndex: 100 }}>
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
          zIndex: 100,
        }}
        aria-hidden="true"
      />

      {/* SLIDE-OVER RIGHT PANEL */}
      <aside
        className="drawer-panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: widthStyle,
          height: "100%",
          backgroundColor: "var(--color-surface, #ffffff)",
          borderLeft: "1px solid var(--color-border, #e2e8f0)",
          boxShadow: "-10px 0 35px -5px rgba(15, 23, 42, 0.18)",
          display: "flex",
          flexDirection: "column",
          zIndex: 101,
          animation: "drawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* DRAWER HEADER */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border, #e2e8f0)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "var(--color-surface-secondary, #f8fafc)",
            flexShrink: 0,
          }}
        >
          <div style={{ paddingRight: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-text-primary, #0f172a)",
                  letterSpacing: "-0.015em",
                  margin: 0,
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
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
          className="custom-scrollbar"
        >
          {children}
        </div>

        {/* DRAWER FOOTER */}
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--color-border, #e2e8f0)",
              backgroundColor: "var(--color-surface, #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              flexShrink: 0,
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
