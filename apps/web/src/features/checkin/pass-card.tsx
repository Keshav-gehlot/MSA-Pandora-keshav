// Flow D, check-in (Alrik): the member's event pass (QR code), shown on the team dashboard once the team is shortlisted.
// Flow B mounts <CheckinPassCard memberId={member.id} /> now; Flow D replaces this body.
// Plan: docs/superpowers/plans/2026-09-26-flow-checkin.md
export async function CheckinPassCard({ memberId }: { memberId: string }) {
  void memberId;
  return null;
}
