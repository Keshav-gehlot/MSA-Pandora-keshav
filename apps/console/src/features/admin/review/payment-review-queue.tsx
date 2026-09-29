"use client";

import { useState, useTransition } from "react";
import type { PendingPaymentItem } from "./payment-actions";
import { reviewPayment } from "./payment-actions";

export type PaymentReviewQueueProps = {
  initialItems: PendingPaymentItem[];
};

export function PaymentReviewQueue({ initialItems }: PaymentReviewQueueProps) {
  const [items, setItems] = useState<PendingPaymentItem[]>(initialItems);
  const [declineOpenId, setDeclineOpenId] = useState<string | null>(null);
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = (proofId: string) => {
    setStatusMessage(null);
    setProcessingId(proofId);

    startTransition(async () => {
      try {
        const res = await reviewPayment(proofId, "approved");
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.proofId !== proofId));
          if (res.warning) {
            setStatusMessage({ type: "warning", text: res.warning });
          } else {
            setStatusMessage({ type: "success", text: "Payment approved successfully" });
          }
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to approve payment" });
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleDeclineSubmit = (proofId: string) => {
    const note = (declineNotes[proofId] ?? "").trim();
    if (!note) {
      setStatusMessage({ type: "error", text: "Please enter a note explaining why this payment was declined" });
      return;
    }
    if (note.length > 500) {
      setStatusMessage({ type: "error", text: "Note must be at most 500 characters" });
      return;
    }

    setStatusMessage(null);
    setProcessingId(proofId);

    startTransition(async () => {
      try {
        const res = await reviewPayment(proofId, "declined", note);
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.proofId !== proofId));
          setDeclineOpenId(null);
          if (res.warning) {
            setStatusMessage({ type: "warning", text: res.warning });
          } else {
            setStatusMessage({ type: "success", text: "Payment declined and feedback sent to team" });
          }
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to decline payment" });
      } finally {
        setProcessingId(null);
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {statusMessage && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-element, 0.5rem)",
            fontSize: "0.875rem",
            fontWeight: 500,
            backgroundColor:
              statusMessage.type === "success"
                ? "#ecfdf5"
                : statusMessage.type === "warning"
                  ? "#fffbeb"
                  : "#fef2f2",
            color:
              statusMessage.type === "success"
                ? "#065f46"
                : statusMessage.type === "warning"
                  ? "#92400e"
                  : "#991b1b",
            border: `1px solid ${
              statusMessage.type === "success"
                ? "#a7f3d0"
                : statusMessage.type === "warning"
                  ? "#fde68a"
                  : "#fecaca"
            }`,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            backgroundColor: "var(--color-background-card, #ffffff)",
            borderRadius: "var(--radius-container, 0.75rem)",
            border: "1px solid var(--color-border, #e5e5e5)",
          }}
        >
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
            No pending payments in the queue
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            All submitted registration payment proofs have been reviewed.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {items.map((item) => {
            const isProcessing = isPending && processingId === item.proofId;
            const isDeclineOpen = declineOpenId === item.proofId;
            const currentNote = declineNotes[item.proofId] ?? "";

            return (
              <div
                key={item.proofId}
                style={{
                  padding: "1.5rem",
                  backgroundColor: "var(--color-background-card, #ffffff)",
                  borderRadius: "var(--radius-container, 0.75rem)",
                  border: "1px solid var(--color-border, #e5e5e5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {item.teamName}
                    </h3>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                      Submitted {new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(item.proofId)}
                      style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "var(--radius-element, 0.375rem)",
                        backgroundColor: "#059669",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        opacity: isProcessing ? 0.6 : 1,
                      }}
                    >
                      {isProcessing ? "Processing..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setDeclineOpenId(isDeclineOpen ? null : item.proofId);
                      }}
                      style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "var(--radius-element, 0.375rem)",
                        backgroundColor: "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        opacity: isProcessing ? 0.6 : 1,
                      }}
                    >
                      {isDeclineOpen ? "Cancel Decline" : "Decline"}
                    </button>
                  </div>
                </div>

                {/* Proof screenshot preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Payment Screenshot
                  </span>
                  {item.signedUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-start" }}>
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          maxWidth: "360px",
                          maxHeight: "360px",
                          borderRadius: "var(--radius-element, 0.5rem)",
                          overflow: "hidden",
                          border: "1px solid var(--color-border, #e5e5e5)",
                          backgroundColor: "#f3f4f6",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.signedUrl}
                          alt={`Payment screenshot for ${item.teamName}`}
                          style={{
                            width: "100%",
                            maxHeight: "360px",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </a>
                      <a
                        href={item.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--color-accent, #2563eb)",
                          textDecoration: "underline",
                        }}
                      >
                        Open full size in new tab ↗
                      </a>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "1rem",
                        borderRadius: "var(--radius-element, 0.375rem)",
                        backgroundColor: "#f3f4f6",
                        color: "var(--color-text-secondary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      Screenshot preview unavailable (path: {item.filePath})
                    </div>
                  )}
                </div>

                {/* Decline note form */}
                {isDeclineOpen && (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#fef2f2",
                      borderRadius: "var(--radius-element, 0.5rem)",
                      border: "1px solid #fecaca",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <label
                      htmlFor={`note-${item.proofId}`}
                      style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991b1b" }}
                    >
                      Reason for declining (required, sent to team members):
                    </label>
                    <textarea
                      id={`note-${item.proofId}`}
                      rows={3}
                      maxLength={500}
                      value={currentNote}
                      placeholder="e.g. Transaction ID was cut off / blurry screenshot. Please upload a clear receipt."
                      onChange={(e) => {
                        setDeclineNotes((prev) => ({ ...prev, [item.proofId]: e.target.value }));
                      }}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "var(--radius-element, 0.375rem)",
                        border: "1px solid #fca5a5",
                        fontSize: "0.875rem",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", color: "#991b1b" }}>
                        {currentNote.length}/500 characters
                      </span>
                      <button
                        type="button"
                        disabled={isProcessing || !currentNote.trim()}
                        onClick={() => handleDeclineSubmit(item.proofId)}
                        style={{
                          padding: "0.4rem 0.875rem",
                          borderRadius: "var(--radius-element, 0.375rem)",
                          backgroundColor: "#dc2626",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          cursor: isProcessing || !currentNote.trim() ? "not-allowed" : "pointer",
                          opacity: isProcessing || !currentNote.trim() ? 0.6 : 1,
                        }}
                      >
                        {isProcessing ? "Submitting..." : "Confirm Decline"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
