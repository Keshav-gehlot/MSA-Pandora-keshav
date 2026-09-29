"use client";

import { useMemo, useState, useTransition } from "react";
import { sendNotice } from "./actions";

export type NoticeTeam = { id: string; name: string };

export function NoticeComposer({ teams }: { teams: NoticeTeam[] }) {
  const [scope, setScope] = useState<"all" | "team">("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const matchingTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teams.filter((team) => team.name.toLowerCase().includes(query)).slice(0, 8);
  }, [search, teams]);

  const selectedTeam = teams.find((team) => team.id === teamId) ?? null;

  const handleSubmit = () => {
    if (scope === "team" && !teamId) {
      setMessage({ type: "error", text: "Choose a team before sending this notice" });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await sendNotice({
        title,
        body,
        teamId: scope === "team" ? teamId : null,
      });

      if (!result.ok) {
        setMessage({ type: "error", text: result.message });
        return;
      }

      setTitle("");
      setBody("");
      setSearch("");
      setTeamId(null);
      setScope("all");
      setMessage({ type: "success", text: "Notice sent successfully" });
    });
  };

  return (
    <form
      action={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {message && (
        <p
          role="status"
          style={{ margin: 0, color: message.type === "success" ? "#065f46" : "#991b1b", fontSize: "0.875rem" }}
        >
          {message.text}
        </p>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontWeight: 600 }}>
        Title
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={120}
          placeholder="Episode 0 is live"
          style={{ padding: "0.625rem", border: "1px solid var(--color-border, #d1d5db)", borderRadius: "0.375rem", font: "inherit" }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontWeight: 600 }}>
        Message
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={2000}
          rows={6}
          placeholder="Write the message participants should see."
          style={{ padding: "0.625rem", border: "1px solid var(--color-border, #d1d5db)", borderRadius: "0.375rem", font: "inherit", resize: "vertical" }}
        />
      </label>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Recipients</legend>
        <label>
          <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} /> All teams
        </label>
        <label>
          <input type="radio" checked={scope === "team"} onChange={() => setScope("team")} /> One team
        </label>
      </fieldset>

      {scope === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="team-search" style={{ fontWeight: 600 }}>Search teams</label>
          <input
            id="team-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Start typing a team name"
            style={{ padding: "0.625rem", border: "1px solid var(--color-border, #d1d5db)", borderRadius: "0.375rem", font: "inherit" }}
          />
          <div role="listbox" aria-label="Matching teams" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {matchingTeams.map((team) => (
              <button
                key={team.id}
                type="button"
                role="option"
                aria-selected={team.id === teamId}
                onClick={() => setTeamId(team.id)}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--color-border, #d1d5db)", borderRadius: "0.375rem", background: team.id === teamId ? "var(--color-accent-muted, #eff6ff)" : "#ffffff", color: "var(--color-text-primary)", cursor: "pointer", textAlign: "left", font: "inherit" }}
              >
                {team.name}
              </button>
            ))}
            {matchingTeams.length === 0 && <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>No teams found</span>}
          </div>
          {selectedTeam && <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Sending to: {selectedTeam.name}</span>}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{ alignSelf: "flex-start", padding: "0.625rem 1rem", border: 0, borderRadius: "0.375rem", background: "var(--color-accent, #2563eb)", color: "#ffffff", font: "inherit", fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
      >
        {isPending ? "Sending..." : "Send notice"}
      </button>
    </form>
  );
}
