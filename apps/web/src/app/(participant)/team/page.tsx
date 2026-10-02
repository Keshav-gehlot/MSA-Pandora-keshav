import { isEpisodeZeroOpen, pageTitle } from "@pandora/core";
import { getDashboard, getTeamSnapshot } from "@pandora/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckinPassCard } from "../../../features/checkin/pass-card";
import { EditDetails } from "../../../features/participant/edit-details";
import { EpisodeZero } from "../../../features/participant/episode-zero";
import { Journey } from "../../../features/participant/journey";
import { Notices } from "../../../features/participant/notices";
import { EventPass, MembersList, PaymentStatus, Welcome } from "../../../features/participant/team-overview";
import { getDb } from "../../../lib/cf-db";
import { requireMember } from "../../../lib/session";
import { toPaymentStatus, toShortlistStatus } from "../../../features/participant/status";

export const metadata: Metadata = { title: pageTitle("Your team"), robots: { index: false } };

// What a participant sees always comes from their session, never from the URL.
export const dynamic = "force-dynamic";

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);

export default async function TeamPage() {
  const { member, team } = await requireMember();
  const db = await getDb();
  const [dashboard, snapshot] = await Promise.all([
    getDashboard(db, { teamId: team.id, memberId: member.id }),
    getTeamSnapshot(db, team.id),
  ]);
  if (!snapshot) redirect("/sign-in");

  const deadline = process.env.EPISODE_0_DEADLINE;
  const episodeOpen = isEpisodeZeroOpen(new Date(), deadline);
  const { submission } = dashboard;
  const paymentStatus = toPaymentStatus(dashboard.team.paymentStatus);
  const shortlistStatus = toShortlistStatus(dashboard.team.shortlistStatus);

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "1.25rem",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      <Welcome firstName={member.firstName} teamName={dashboard.team.name} track={dashboard.team.track} />
      <MembersList members={dashboard.members} />
      <Journey
        shortlistStatus={shortlistStatus}
        paymentStatus={paymentStatus}
        episodeOpen={episodeOpen}
      />
      <PaymentStatus status={paymentStatus} />
      <Notices
        unreadCount={dashboard.unreadCount}
        notices={dashboard.notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          createdAt: formatTime(new Date(n.createdAt)),
          read: n.read,
        }))}
      />
      <EditDetails snapshot={snapshot} pendingEdit={dashboard.pendingEdit} />
      <EpisodeZero
        initial={
          submission
            ? { repoUrl: submission.repoUrl ?? "", demoUrl: submission.demoUrl ?? "", notes: submission.notes ?? "" }
            : null
        }
        savedAt={submission ? formatTime(new Date(submission.updatedAt)) : null}
        episodeOpen={episodeOpen}
        paymentStatus={paymentStatus}
      />
      <EventPass shortlisted={shortlistStatus === "shortlisted"}>
        <CheckinPassCard memberId={member.id} />
      </EventPass>
    </main>
  );
}
