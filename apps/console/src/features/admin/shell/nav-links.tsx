"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_NAV_ITEMS = [
  { label: "Overview", href: "/" },
  { label: "Teams", href: "/teams" },
  { label: "Payments", href: "/payments" },
  { label: "Edit requests", href: "/edits" },
  { label: "Notices", href: "/notices" },
  { label: "Episode 0", href: "/episode-0" },
  { label: "Export", href: "/export" },
] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav aria-label="Admin console navigation" style={{ width: "100%" }}>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isItemActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-element, 0.375rem)",
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 500,
                  textDecoration: "none",
                  color: active
                    ? "var(--color-accent, #2563eb)"
                    : "var(--color-text-secondary, #4b5563)",
                  backgroundColor: active
                    ? "var(--color-accent-muted, #eff6ff)"
                    : "transparent",
                  transition: "background-color 0.15s ease, color 0.15s ease",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
