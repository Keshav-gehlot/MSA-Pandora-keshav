"use client";

import { useEffect, useState, useTransition } from "react";
import { getAttendanceSummaryAction, type TeamAttendance } from "../../../features/checkin/actions";

export function AttendanceView({ initialData }: { initialData: TeamAttendance[] }) {
  const [data, setData] = useState<TeamAttendance[]>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, startRefresh] = useTransition();

  const refreshData = () => {
    startRefresh(async () => {
      try {
        const res = await getAttendanceSummaryAction();
        if (res.ok) {
          setData(res.data);
          setLastUpdated(new Date());
        }
      } catch {
        // Silently ignore transient network poll errors
      }
    });
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalExpected = data.reduce((acc, team) => acc + team.expected, 0);
  const totalPresent = data.reduce((acc, team) => acc + team.present, 0);
  const totalPercentage = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(lastUpdated);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%" }}>
      {/* TOTAL METRICS CARD */}
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-container, 0.75rem)",
          border: "1px solid var(--color-border, #e5e5e5)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>
              Total Attendance
            </span>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827", marginTop: "0.125rem" }}>
              {totalPresent} <span style={{ fontSize: "1.125rem", fontWeight: 400, color: "#6b7280" }}>/ {totalExpected}</span>
            </div>
          </div>

          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              backgroundColor: totalPercentage >= 80 ? "#dcfce7" : "#eff6ff",
              color: totalPercentage >= 80 ? "#15803d" : "#1d4ed8",
              fontWeight: 700,
              fontSize: "1.125rem",
            }}
          >
            {totalPercentage}%
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#e5e7eb",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, totalPercentage)}%`,
              height: "100%",
              backgroundColor: "#2563eb",
              borderRadius: "9999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            Updated at {timeStr} IST • Refreshes every 15s
          </span>

          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#2563eb",
              backgroundColor: "transparent",
              border: "none",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              padding: "0.25rem",
            }}
          >
            {isRefreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* TEAM BREAKDOWN */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "#111827" }}>
          Shortlisted Teams ({data.length})
        </h3>

        {data.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-container, 0.75rem)",
              border: "1px solid var(--color-border, #e5e5e5)",
              color: "#6b7280",
              fontSize: "0.875rem",
            }}
          >
            No shortlisted teams found.
          </div>
        ) : (
          data.map((team) => {
            const teamPercent = team.expected > 0 ? Math.round((team.present / team.expected) * 100) : 0;
            const isComplete = team.present === team.expected && team.expected > 0;

            return (
              <div
                key={team.teamId}
                style={{
                  padding: "0.875rem 1rem",
                  backgroundColor: "#ffffff",
                  borderRadius: "var(--radius-element, 0.5rem)",
                  border: "1px solid var(--color-border, #e5e5e5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>
                    {team.teamName}
                  </span>

                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.125rem 0.5rem",
                      borderRadius: "9999px",
                      backgroundColor: isComplete ? "#dcfce7" : "#f3f4f6",
                      color: isComplete ? "#15803d" : "#4b5563",
                    }}
                  >
                    {team.present} / {team.expected} present
                  </span>
                </div>

                {/* Team Mini Progress Bar */}
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, teamPercent)}%`,
                      height: "100%",
                      backgroundColor: isComplete ? "#16a34a" : "#3b82f6",
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
