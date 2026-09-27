"use client";

import { useState, type ReactNode } from "react";
import { Wordmark } from "@pandora/ui";
import { NavLinks } from "./nav-links";
import { UserMenu, type UserMenuProps } from "./user-menu";

export type ConsoleShellProps = {
  staff: UserMenuProps;
  children: ReactNode;
};

export function ConsoleShell({ staff, children }: ConsoleShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        backgroundColor: "var(--color-background-body, #f9fafb)",
        color: "var(--color-text-primary, #111827)",
      }}
    >
      {/* Desktop Sidebar */}
      <aside
        style={{
          width: "250px",
          flexShrink: 0,
          borderRight: "1px solid var(--color-border, #e5e5e5)",
          backgroundColor: "var(--color-background-card, #ffffff)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "1.25rem",
          boxSizing: "border-box",
        }}
        className="console-desktop-sidebar"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Wordmark size="sm" />
            <span
              style={{
                padding: "0.125rem 0.375rem",
                fontSize: "0.6875rem",
                fontWeight: 700,
                borderRadius: "var(--radius-element, 0.25rem)",
                backgroundColor: "var(--color-neutral, #f3f4f6)",
                color: "var(--color-text-secondary, #4b5563)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Console
            </span>
          </div>

          <NavLinks />
        </div>

        <UserMenu name={staff.name} email={staff.email} role={staff.role} />
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile Header */}
        <header
          className="console-mobile-header"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--color-background-card, #ffffff)",
            borderBottom: "1px solid var(--color-border, #e5e5e5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Wordmark size="sm" />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              Console
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            style={{
              padding: "0.375rem 0.625rem",
              borderRadius: "var(--radius-element, 0.375rem)",
              border: "1px solid var(--color-border, #d1d5db)",
              backgroundColor: "transparent",
              color: "var(--color-text-primary)",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {mobileMenuOpen ? "Close" : "Menu"}
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="console-mobile-drawer"
            style={{
              display: "none",
              flexDirection: "column",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: "var(--color-background-card, #ffffff)",
              borderBottom: "1px solid var(--color-border, #e5e5e5)",
            }}
          >
            <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
            <UserMenu name={staff.name} email={staff.email} role={staff.role} />
          </div>
        )}

        <main style={{ flex: 1, padding: "1.5rem", maxWidth: "1200px", width: "100%", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .console-desktop-sidebar {
            display: none !important;
          }
          .console-mobile-header {
            display: flex !important;
          }
          .console-mobile-drawer {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
