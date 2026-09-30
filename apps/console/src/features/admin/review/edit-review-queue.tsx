"use client";

import { useState, useTransition } from "react";
import type { PendingEditItem } from "./edit-actions";
import { reviewEditRequest } from "./edit-actions";

export type EditReviewQueueProps = {
  initialItems: PendingEditItem[];
};

function formatFieldPath(path: string): string {
  if (path === "teamName") return "Team Name";
  if (path === "track") return "Track";
  if (path.startsWith("members.")) {
    const parts = path.split(".");
    const field = parts[2] ?? "";
    const memberId = parts[1] ? ` (${parts[1].slice(0, 6)})` : "";
    switch (field) {
      case "firstName":
        return `Member First Name${memberId}`;
      case "lastName":
        return `Member Last Name${memberId}`;
      case "regNumber":
        return `Member Reg Number${memberId}`;
      case "srmEmail":
        return `Member SRM Email${memberId}`;
      case "personalEmail":
        return `Member Personal Email${memberId}`;
      case "phone":
        return `Member Phone${memberId}`;
      default:
        return path;
    }
  }
  return path;
}

export function EditReviewQueue({ initialItems }: EditReviewQueueProps) {
  const [items, setItems] = useState<PendingEditItem[]>(initialItems);
  const [declineOpenId, setDeclineOpenId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = (requestId: string) => {
    setStatusMessage(null);
    setProcessingId(requestId);
    const note = (reviewNotes[requestId] ?? "").trim();

    startTransition(async () => {
      try {
        const res = await reviewEditRequest(requestId, "approved", note || undefined);
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.requestId !== requestId));
          if (res.warning) {
            setStatusMessage({ type: "warning", text: res.warning });
          } else {
            setStatusMessage({ type: "success", text: "Edit request approved successfully" });
          }
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to approve edit request",
        });
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleDeclineSubmit = (requestId: string) => {
    const note = (reviewNotes[requestId] ?? "").trim();
    if (note.length > 500) {
      setStatusMessage({ type: "error", text: "Note must be at most 500 characters" });
      return;
    }

    setStatusMessage(null);
    setProcessingId(requestId);

    startTransition(async () => {
      try {
        const res = await reviewEditRequest(requestId, "declined", note || undefined);
        if (res.ok) {
          setItems((prev) => prev.filter((i) => i.requestId !== requestId));
          setDeclineOpenId(null);
          if (res.warning) {
            setStatusMessage({ type: "warning", text: res.warning });
          } else {
            setStatusMessage({ type: "success", text: "Edit request declined and team notified" });
          }
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to decline edit request",
        });
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
            borderRadius: "var(--radius-container, 0.75rem)",
            backgroundColor: "var(--color-background-card, #ffffff)",
            border: "1px solid var(--color-border, #e5e5e5)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--color-text-primary, #111827)",
            }}
          >
            No pending edit requests
          </p>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              color: "var(--color-text-secondary, #4b5563)",
            }}
          >
            All team change requests have been reviewed.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #4b5563)" }}>
            Showing {items.length} pending edit request{items.length === 1 ? "" : "s"} (oldest first)
          </div>

          {items.map((item) => {
            const isProcessingThis = processingId === item.requestId;
            const isDeclineOpen = declineOpenId === item.requestId;
            const currentNote = reviewNotes[item.requestId] ?? "";

            return (
              <div
                key={item.requestId}
                style={{
                  borderRadius: "var(--radius-container, 0.75rem)",
                  backgroundColor: "var(--color-background-card, #ffffff)",
                  border: "1px solid var(--color-border, #e5e5e5)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "var(--color-text-primary, #111827)",
                      }}
                    >
                      {item.teamName}
                    </h2>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "0.875rem",
                        color: "var(--color-text-secondary, #4b5563)",
                      }}
                    >
                      Requested by <strong>{item.requestedByName}</strong> •{" "}
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.625rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fde68a",
                    }}
                  >
                    Pending Review
                  </span>
                </div>

                {/* Changes Table: Before → After */}
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.875rem",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--color-border, #e5e5e5)",
                          backgroundColor: "var(--color-background-body, #f9fafb)",
                        }}
                      >
                        <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600, width: "30%" }}>
                          Field
                        </th>
                        <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600, width: "35%" }}>
                          Before
                        </th>
                        <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600, width: "35%" }}>
                          After
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.changes.map((change, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid var(--color-border, #e5e5e5)",
                          }}
                        >
                          <td style={{ padding: "0.625rem 0.75rem", fontWeight: 500 }}>
                            {formatFieldPath(change.path)}
                          </td>
                          <td
                            style={{
                              padding: "0.625rem 0.75rem",
                              color: "#dc2626",
                              textDecoration: "line-through",
                            }}
                          >
                            {change.from || <span style={{ opacity: 0.5 }}>[empty]</span>}
                          </td>
                          <td
                            style={{
                              padding: "0.625rem 0.75rem",
                              color: "#16a34a",
                              fontWeight: 600,
                            }}
                          >
                            {change.to || <span style={{ opacity: 0.5 }}>[empty]</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions and Note */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    borderTop: "1px solid var(--color-border, #e5e5e5)",
                    paddingTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(item.requestId)}
                        disabled={isPending || isProcessingThis}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "var(--radius-element, 0.375rem)",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          backgroundColor: "#16a34a",
                          color: "#ffffff",
                          border: "none",
                          cursor: isPending || isProcessingThis ? "not-allowed" : "pointer",
                          opacity: isPending || isProcessingThis ? 0.6 : 1,
                        }}
                      >
                        {isProcessingThis ? "Processing..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isDeclineOpen) {
                            setDeclineOpenId(null);
                          } else {
                            setDeclineOpenId(item.requestId);
                          }
                        }}
                        disabled={isPending || isProcessingThis}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "var(--radius-element, 0.375rem)",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          backgroundColor: "#ffffff",
                          color: "#dc2626",
                          border: "1px solid #dc2626",
                          cursor: isPending || isProcessingThis ? "not-allowed" : "pointer",
                          opacity: isPending || isProcessingThis ? 0.6 : 1,
                        }}
                      >
                        {isDeclineOpen ? "Cancel" : "Decline..."}
                      </button>
                    </div>

                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #4b5563)" }}>
                      {item.changes.length} change{item.changes.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Optional Review Note or Decline Form */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <label
                        htmlFor={`note-${item.requestId}`}
                        style={{ color: "var(--color-text-secondary, #4b5563)", fontWeight: 500 }}
                      >
                        {isDeclineOpen ? "Reason for declining (sent to team):" : "Review note (optional):"}
                      </label>
                      <span
                        style={{
                          color:
                            currentNote.length > 500
                              ? "#dc2626"
                              : "var(--color-text-secondary, #4b5563)",
                        }}
                      >
                        {currentNote.length}/500
                      </span>
                    </div>

                    <input
                      id={`note-${item.requestId}`}
                      type="text"
                      value={currentNote}
                      maxLength={500}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({
                          ...prev,
                          [item.requestId]: e.target.value,
                        }))
                      }
                      placeholder={
                        isDeclineOpen
                          ? "e.g., Member cannot change registration number after verification"
                          : "Optional note included in email and audit log"
                      }
                      disabled={isPending || isProcessingThis}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "var(--radius-element, 0.375rem)",
                        border: "1px solid var(--color-border, #d1d5db)",
                        fontSize: "0.875rem",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />

                    {isDeclineOpen && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                        <button
                          type="button"
                          onClick={() => handleDeclineSubmit(item.requestId)}
                          disabled={isPending || isProcessingThis}
                          style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "var(--radius-element, 0.375rem)",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            backgroundColor: "#dc2626",
                            color: "#ffffff",
                            border: "none",
                            cursor: isPending || isProcessingThis ? "not-allowed" : "pointer",
                            opacity: isPending || isProcessingThis ? 0.6 : 1,
                          }}
                        >
                          {isProcessingThis ? "Declining..." : "Confirm Decline"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
