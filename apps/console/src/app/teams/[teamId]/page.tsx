import type { Metadata } from "next";
import Link from "next/link";
import { fileUrl, getTeamDetail } from "@pandora/db";
import { pageTitle } from "@pandora/core";
import { notFound } from "next/navigation";
import { ConsoleShell } from "../../../features/admin/shell/console-shell";
import { getDb } from "../../../lib/cf-db";
import { requireStaff } from "../../../lib/session";

export const metadata: Metadata = { title: pageTitle("Team details - Console") };
type Props = { params: Promise<{ teamId: string }> };
const box = { border: "1px solid var(--color-border, #e5e5e5)", borderRadius: "var(--radius-container, .5rem)", padding: "1rem" } as const;

export default async function TeamDetailPage({ params }: Props) {
  const admin = await requireStaff("admin");
  const detail = await getTeamDetail(await getDb(), (await params).teamId);
  if (!detail) notFound();
  const photos = new Map(detail.members.map((member) => [member.id, member.photoPath ? fileUrl(member.photoPath) : null] as const));
  const proofs = new Map(detail.paymentProofs.map((proof) => [proof.id, fileUrl(proof.filePath)] as const));
  return <ConsoleShell staff={admin}><div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
    <div><Link href="/teams">Back to teams</Link><h1 style={{ margin: ".5rem 0 0", fontSize: "1.5rem" }}>{detail.team.name}</h1><p style={{ margin: ".25rem 0 0", color: "var(--color-text-secondary)" }}>{detail.team.track} · Payment: {detail.team.paymentStatus.replaceAll("_", " ")} · Shortlist: {detail.team.shortlistStatus.replaceAll("_", " ")}</p></div>
    <section style={box}><h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Members</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: ".75rem" }}>{detail.members.map((member) => <article key={member.id} style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: ".375rem", padding: ".75rem" }}><strong>{member.firstName} {member.lastName}{member.isLeader ? " (Leader)" : ""}</strong><p style={{ margin: ".5rem 0 0", fontSize: ".875rem" }}>{member.regNumber}<br />{member.srmEmail}<br />{member.personalEmail}<br />{member.phone}</p>{photos.get(member.id) ? <a href={photos.get(member.id)!} target="_blank" rel="noreferrer">View photo</a> : <span>No photo</span>}</article>)}</div></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}><div style={box}><h2 style={{ margin: "0 0 .75rem", fontSize: "1rem" }}>Payment proofs</h2>{detail.paymentProofs.length ? <ul>{detail.paymentProofs.map((proof) => <li key={proof.id}><a href={proofs.get(proof.id)} target="_blank" rel="noreferrer">View proof</a> · {proof.status}</li>)}</ul> : <p>No payment proofs.</p>}</div><div style={box}><h2 style={{ margin: "0 0 .75rem", fontSize: "1rem" }}>Edit history</h2>{detail.editRequests.length ? <ul>{detail.editRequests.map((request) => <li key={request.id}>{request.status} · {request.createdAt.toLocaleString("en-IN")}</li>)}</ul> : <p>No edit requests.</p>}</div></section>
    <section style={box}><h2 style={{ margin: "0 0 .75rem", fontSize: "1rem" }}>Episode 0 submission</h2>{detail.submission ? <div><p>Repository: {detail.submission.repoUrl ? <a href={detail.submission.repoUrl} target="_blank" rel="noreferrer">{detail.submission.repoUrl}</a> : "Not provided"}</p><p>Demo: {detail.submission.demoUrl ? <a href={detail.submission.demoUrl} target="_blank" rel="noreferrer">{detail.submission.demoUrl}</a> : "Not provided"}</p><p style={{ whiteSpace: "pre-wrap" }}>Notes: {detail.submission.notes || "No notes"}</p></div> : <p>No Episode 0 submission.</p>}</section>
  </div></ConsoleShell>;
}
