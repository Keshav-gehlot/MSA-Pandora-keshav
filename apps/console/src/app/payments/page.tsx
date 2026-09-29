import type { Metadata } from "next";
import { isPaymentEnabled, pageTitle } from "@pandora/core";
import { ConsoleShell } from "../../features/admin/shell/console-shell";
import { fetchPendingPayments } from "../../features/admin/review/payment-actions";
import { PaymentReviewQueue } from "../../features/admin/review/payment-review-queue";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Payment Review - Console"),
};

export default async function PaymentsPage() {
  const admin = await requireStaff("admin");
  const paymentEnabled = isPaymentEnabled(process.env.PAYMENT_ENABLED);

  const pendingItems = paymentEnabled ? await fetchPendingPayments() : [];

  return (
    <ConsoleShell staff={admin}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Payment Review
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            Review pending registration payment screenshots and notify teams.
          </p>
        </div>

        {!paymentEnabled ? (
          <div
            style={{
              padding: "2rem",
              borderRadius: "var(--radius-container, 0.75rem)",
              backgroundColor: "var(--color-background-card, #ffffff)",
              border: "1px solid var(--color-border, #e5e5e5)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Payments are off
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Registration payments are currently disabled (PAYMENT_ENABLED is not set to true).
            </p>
          </div>
        ) : (
          <PaymentReviewQueue initialItems={pendingItems} />
        )}
      </div>
    </ConsoleShell>
  );
}
