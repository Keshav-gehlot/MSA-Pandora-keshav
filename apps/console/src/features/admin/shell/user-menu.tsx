"use client";

import { useTransition } from "react";
import { staffSignOut } from "../sign-in/actions";

export type UserMenuProps = {
  name: string;
  email: string;
  role: "admin" | "staff";
};

export function UserMenu({ name, email, role }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await staffSignOut();
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.875rem",
        borderRadius: "var(--radius-element, 0.5rem)",
        backgroundColor: "var(--color-background-surface, #ffffff)",
        border: "1px solid var(--color-border, #e5e5e5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--color-text-primary, #111827)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-secondary, #6b7280)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {email}
          </div>
        </div>

        <span
          style={{
            padding: "0.125rem 0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            borderRadius: "var(--radius-full, 9999px)",
            backgroundColor:
              role === "admin"
                ? "var(--color-background-blue, #dbeafe)"
                : "var(--color-background-gray, #f3f4f6)",
            color:
              role === "admin"
                ? "var(--color-text-blue, #1d4ed8)"
                : "var(--color-text-secondary, #4b5563)",
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}
        >
          {role}
        </span>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        style={{
          width: "100%",
          padding: "0.375rem 0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 500,
          borderRadius: "var(--radius-element, 0.375rem)",
          backgroundColor: "transparent",
          color: "var(--color-text-secondary, #4b5563)",
          border: "1px solid var(--color-border, #d1d5db)",
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.6 : 1,
          transition: "background-color 0.15s ease",
        }}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
