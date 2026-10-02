"use client";

import { useState, useTransition } from "react";
import type { SubmissionItem } from "./episode-0-actions";
import { resendPassEmailAction, submitReviewAction, updateShortlistAction } from "./episode-0-actions";

export type Episode0TableProps = {
  initialSubmissions: SubmissionItem[];
  target: number;
};

export function Episode0Table({ initialSubmissions, target }: Episode0TableProps) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>(initialSubmissions);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState<string>("");
  const [reviewNote, setReviewNote] = useState<string>("");

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const shortlistedCount = submissions.filter(
    (s) => s.shortlistStatus === "shortlisted",
  ).length;

  const handleOpenReview = (item: SubmissionItem) => {
    setReviewingId(item.submissionId);
    setReviewScore(item.score !== null ? String(item.score) : "");
    setReviewNote(item.reviewNote ?? "");
    setStatusMessage(null);
  };

  const handleCloseReview = () => {
    setReviewingId(null);
    setReviewScore("");
    setReviewNote("");
  };

  const handleSubmitReview = (submissionId: string) => {
    const numScore = Number(reviewScore.trim());
    if (isNaN(numScore) || !Number.isInteger(numScore) || numScore < 0 || numScore > 100) {
      setStatusMessage({ type: "error", text: "Score must be a whole number between 0 and 100" });
      return;
    }
    if (reviewNote.length > 1000) {
      setStatusMessage({ type: "error", text: "Note must be at most 1000 characters" });
      return;
    }

    setStatusMessage(null);
    setProcessingId(submissionId);

    startTransition(async () => {
      try {
        const res = await submitReviewAction(submissionId, numScore, reviewNote.trim());
        if (res.ok) {
          setSubmissions((prev) =>
            prev.map((s) =>
              s.submissionId === submissionId
                ? {
                    ...s,
                    score: numScore,
                    reviewNote: reviewNote.trim() || null,
                  }
                : s,
            ),
          );
          handleCloseReview();
          setStatusMessage({ type: "success", text: "Submission review saved successfully" });
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to save review",
        });
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleShortlist = (
    teamId: string,
    status: "pending" | "shortlisted" | "not_shortlisted",
  ) => {
    setStatusMessage(null);
    setProcessingId(teamId);

    startTransition(async () => {
      try {
        const res = await updateShortlistAction(teamId, status);
        if (res.ok) {
          setSubmissions((prev) =>
            prev.map((s) => (s.teamId === teamId ? { ...s, shortlistStatus: status } : s)),
          );
          setStatusMessage(
            res.warning
              ? { type: "warning", text: res.warning }
              : {
                  type: "success",
                  text:
                    status === "shortlisted"
                      ? "Team marked as shortlisted"
                      : status === "not_shortlisted"
                        ? "Team marked as not shortlisted"
                        : "Team shortlist status reset to pending",
                },
          );
        } else {
          setStatusMessage({ type: "error", text: res.message });
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Failed to update shortlist status",
        });
      } finally {
        setProcessingId(null);
      }
    });
  };

  const handleResendPassEmail = (teamId: string) => {
    setStatusMessage(null);
    setProcessingId(teamId);

    startTransition(async () => {
      try {
        const res = await resendPassEmailAction(teamId);
        setStatusMessage(
          res.ok
            ? { type: "success", text: "Pass email sent again to every member" }
            : { type: "error", text: res.message },
        );
      } catch {
        setStatusMessage({ type: "error", text: "Failed to resend the pass email" });
      } finally {
        setProcessingId(null);
      }
    });
  };

  const filteredSubmissions = submissions.filter((item) => {
    if (statusFilter !== "all" && item.shortlistStatus !== statusFilter) {
      return false;
    }
    if (trackFilter !== "all" && item.track !== trackFilter) {
      return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        item.teamName.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner: Counter & Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          padding: "1.25rem",
          backgroundColor: "var(--color-background-card, #ffffff)",
          border: "1px solid var(--color-border, #e5e5e5)",
          borderRadius: "var(--radius-container, 0.75rem)",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              padding: "0.5rem 0.875rem",
              borderRadius: "var(--radius-element, 0.5rem)",
              backgroundColor:
                shortlistedCount >= target
                  ? "#ecfdf5"
                  : shortlistedCount > 0
                    ? "#eff6ff"
                    : "#f9fafb",
              color:
                shortlistedCount >= target
                  ? "#065f46"
                  : shortlistedCount > 0
                    ? "#1d4ed8"
                    : "#374151",
              border: `1px solid ${
                shortlistedCount >= target
                  ? "#a7f3d0"
                  : shortlistedCount > 0
                    ? "#bfdbfe"
                    : "#e5e7eb"
              }`,
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            shortlisted {shortlistedCount} of target {target}
          </div>
          <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #4b5563)" }}>
            ({submissions.length} total Episode 0 submission{submissions.length === 1 ? "" : "s"})
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "var(--radius-element, 0.375rem)",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.875rem",
            }}
          />

          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "var(--radius-element, 0.375rem)",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.875rem",
              backgroundColor: "#ffffff",
            }}
          >
            <option value="all">All Tracks</option>
            <option value="Track A">Track A</option>
            <option value="Track B">Track B</option>
            <option value="Track C">Track C</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "var(--radius-element, 0.375rem)",
              border: "1px solid var(--color-border, #d1d5db)",
              fontSize: "0.875rem",
              backgroundColor: "#ffffff",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="not_shortlisted">Not Shortlisted</option>
          </select>
        </div>
      </div>

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

      {/* Submissions Table */}
      {filteredSubmissions.length === 0 ? (
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
            No submissions found
          </p>
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.875rem",
              color: "var(--color-text-secondary, #4b5563)",
            }}
          >
            {submissions.length === 0
              ? "No Episode 0 submissions have been submitted yet."
              : "No submissions match the selected filters."}
          </p>
        </div>
      ) : (
        <div
          style={{
            borderRadius: "var(--radius-container, 0.75rem)",
            backgroundColor: "var(--color-background-card, #ffffff)",
            border: "1px solid var(--color-border, #e5e5e5)",
            overflowX: "auto",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
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
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, width: "80px" }}>Score</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Team & Track</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Repository & Demo</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Review Notes</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 600, textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((item) => {
                const isProcessingThis =
                  processingId === item.submissionId || processingId === item.teamId;
                const isEditingReview = reviewingId === item.submissionId;

                return (
                  <tr
                    key={item.submissionId}
                    style={{
                      borderBottom: "1px solid var(--color-border, #e5e5e5)",
                    }}
                  >
                    {/* Score */}
                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                      {item.score !== null ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "var(--radius-element, 0.25rem)",
                            fontWeight: 700,
                            fontSize: "0.9375rem",
                            backgroundColor:
                              item.score >= 80
                                ? "#ecfdf5"
                                : item.score >= 50
                                  ? "#fffbeb"
                                  : "#fef2f2",
                            color:
                              item.score >= 80
                                ? "#065f46"
                                : item.score >= 50
                                  ? "#92400e"
                                  : "#991b1b",
                          }}
                        >
                          {item.score}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "var(--color-text-secondary, #9ca3af)",
                            fontStyle: "italic",
                          }}
                        >
                          Unscored
                        </span>
                      )}
                    </td>

                    {/* Team & Track */}
                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: "var(--color-text-primary, #111827)" }}>
                        {item.teamName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #6b7280)" }}>
                        {item.track}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor:
                            item.shortlistStatus === "shortlisted"
                              ? "#ecfdf5"
                              : item.shortlistStatus === "not_shortlisted"
                                ? "#f3f4f6"
                                : "#fef3c7",
                          color:
                            item.shortlistStatus === "shortlisted"
                              ? "#065f46"
                              : item.shortlistStatus === "not_shortlisted"
                                ? "#4b5563"
                                : "#92400e",
                          border: `1px solid ${
                            item.shortlistStatus === "shortlisted"
                              ? "#a7f3d0"
                              : item.shortlistStatus === "not_shortlisted"
                                ? "#e5e7eb"
                                : "#fde68a"
                          }`,
                        }}
                      >
                        {item.shortlistStatus === "shortlisted"
                          ? "Shortlisted"
                          : item.shortlistStatus === "not_shortlisted"
                            ? "Not Shortlisted"
                            : "Pending"}
                      </span>
                    </td>

                    {/* Repo & Demo URLs */}
                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {item.repoUrl ? (
                          <a
                            href={item.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#2563eb",
                              textDecoration: "underline",
                              fontSize: "0.8125rem",
                            }}
                          >
                            Repository ↗
                          </a>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                            No repository
                          </span>
                        )}

                        {item.demoUrl ? (
                          <a
                            href={item.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#2563eb",
                              textDecoration: "underline",
                              fontSize: "0.8125rem",
                            }}
                          >
                            Live Demo ↗
                          </a>
                        ) : null}

                        {item.notes ? (
                          <details style={{ marginTop: "0.25rem", fontSize: "0.75rem" }}>
                            <summary style={{ cursor: "pointer", color: "#4b5563" }}>
                              Participant note
                            </summary>
                            <p
                              style={{
                                margin: "0.25rem 0 0",
                                padding: "0.375rem",
                                backgroundColor: "#f9fafb",
                                borderRadius: "0.25rem",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {item.notes}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    </td>

                    {/* Review Note & Inline Review Form */}
                    <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                      {isEditingReview ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            minWidth: "220px",
                          }}
                        >
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label
                              htmlFor={`score-${item.submissionId}`}
                              style={{ fontSize: "0.75rem", fontWeight: 600 }}
                            >
                              Score (0-100):
                            </label>
                            <input
                              id={`score-${item.submissionId}`}
                              type="number"
                              min={0}
                              max={100}
                              value={reviewScore}
                              onChange={(e) => setReviewScore(e.target.value)}
                              style={{
                                width: "60px",
                                padding: "0.25rem 0.375rem",
                                fontSize: "0.875rem",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.25rem",
                              }}
                            />
                          </div>
                          <textarea
                            rows={2}
                            maxLength={1000}
                            placeholder="Feedback / Review notes..."
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            style={{
                              padding: "0.375rem",
                              fontSize: "0.8125rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.25rem",
                              width: "100%",
                              boxSizing: "border-box",
                            }}
                          />
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            <button
                              type="button"
                              onClick={() => handleSubmitReview(item.submissionId)}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCloseReview}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#f3f4f6",
                                color: "#374151",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {item.reviewNote ? (
                            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#374151" }}>
                              {item.reviewNote}
                            </p>
                          ) : (
                            <span style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>
                              No review note
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        verticalAlign: "top",
                        textAlign: "right",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.375rem",
                          alignItems: "flex-end",
                        }}
                      >
                        {!isEditingReview && (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(item)}
                            disabled={isPending || isProcessingThis}
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                              border: "1px solid #d1d5db",
                              borderRadius: "0.25rem",
                              cursor: "pointer",
                            }}
                          >
                            {item.score !== null ? "Edit Score" : "Score"}
                          </button>
                        )}

                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {item.shortlistStatus !== "shortlisted" && (
                            <button
                              type="button"
                              onClick={() => handleShortlist(item.teamId, "shortlisted")}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            >
                              Shortlist
                            </button>
                          )}

                          {item.shortlistStatus === "shortlisted" && (
                            <button
                              type="button"
                              onClick={() => handleResendPassEmail(item.teamId)}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                border: "1px solid var(--color-border, #d1d5db)",
                                borderRadius: "0.25rem",
                                background: "transparent",
                                color: "var(--color-text-primary)",
                                cursor: "pointer",
                              }}
                            >
                              Resend pass email
                            </button>
                          )}

                          {item.shortlistStatus !== "not_shortlisted" && (
                            <button
                              type="button"
                              onClick={() => handleShortlist(item.teamId, "not_shortlisted")}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: "#ffffff",
                                color: "#dc2626",
                                border: "1px solid #dc2626",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            >
                              Pass
                            </button>
                          )}

                          {item.shortlistStatus !== "pending" && (
                            <button
                              type="button"
                              onClick={() => handleShortlist(item.teamId, "pending")}
                              disabled={isPending || isProcessingThis}
                              style={{
                                padding: "0.25rem 0.5rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#ffffff",
                                color: "#6b7280",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.25rem",
                                cursor: "pointer",
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
