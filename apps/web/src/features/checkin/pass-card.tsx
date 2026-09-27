import "server-only";
import { formatPassPayload } from "@pandora/core";
import { getDb, getMemberWithTeam, getPassToken } from "@pandora/db";
import QRCode from "qrcode";

// Flow D, check-in (Alrik): the member's event pass (QR code), shown on the team dashboard once the team is shortlisted.
// Flow B mounts <CheckinPassCard memberId={member.id} /> in the dashboard.
// Plan: docs/superpowers/plans/2026-09-26-flow-checkin.md (Task D3)
export async function CheckinPassCard({ memberId }: { memberId: string }) {
  const secret = process.env.PASS_SECRET;
  if (!secret) {
    return null;
  }

  const db = getDb();
  const token = await getPassToken(db, { memberId, secret });
  if (!token) {
    return null;
  }

  const memberInfo = await getMemberWithTeam(db, memberId);
  const memberName = memberInfo
    ? `${memberInfo.member.firstName} ${memberInfo.member.lastName}`.trim()
    : "Participant";

  const payload = formatPassPayload(token);
  const qrSvg = await QRCode.toString(payload, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    width: 220,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return (
    <section
      aria-label="Event check-in pass"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "1rem",
        padding: "1.5rem",
        borderRadius: "1rem",
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
        color: "#f4f4f5",
        maxWidth: "340px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#a1a1aa",
          }}
        >
          Event Pass
        </span>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            margin: 0,
            color: "#fafafa",
          }}
        >
          {memberName}
        </h2>
      </div>

      <div
        style={{
          padding: "0.5rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          display: "inline-flex",
          justifyContent: "center",
          alignItems: "center",
          lineHeight: 0,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        }}
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <p
        style={{
          fontSize: "0.875rem",
          color: "#a1a1aa",
          margin: 0,
        }}
      >
        Show this at the entrance
      </p>
    </section>
  );
}
