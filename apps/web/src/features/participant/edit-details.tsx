"use client";

import { TRACKS, type FieldChange, type TeamSnapshot } from "@pandora/core";
import { Banner, Button, Heading, Selector, Text, TextInput } from "@pandora/ui";
import { useState, type FormEvent } from "react";
import { submitEdit } from "./dashboard-actions";
import { describeChangePath, MEMBER_FIELDS, memberFieldName } from "./edit-form";

type PendingEdit = { id: string; changes: FieldChange[] } | null;

const section = { display: "flex", flexDirection: "column", gap: "0.75rem" } as const;

export function EditDetails({ snapshot, pendingEdit }: { snapshot: TeamSnapshot; pendingEdit: PendingEdit }) {
  const [teamName, setTeamName] = useState(snapshot.teamName);
  const [track, setTrack] = useState<string>(snapshot.track);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const m of snapshot.members) for (const { key } of MEMBER_FIELDS) initial[memberFieldName(m.id, key)] = m[key];
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (pendingEdit || sent) {
    return (
      <section aria-labelledby="edit-heading" style={section}>
        <Heading level={2} id="edit-heading">
          Edit details
        </Heading>
        {sent && !pendingEdit ? (
          <Banner
            status="success"
            title="Sent for review. Nothing changes until an admin approves it."
            collapsible={false}
          />
        ) : (
          <Banner status="info" title="Pending review" collapsible={false} />
        )}
        {pendingEdit ? (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {pendingEdit.changes.map((change) => (
              <li key={change.path}>
                <Text as="span">
                  {describeChangePath(change.path, snapshot.members)}: {change.from} to {change.to}
                </Text>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setErrors({});

    const data = new FormData();
    data.set("teamName", teamName);
    data.set("track", track);
    for (const [name, value] of Object.entries(values)) data.set(name, value);

    try {
      const result = await submitEdit(data);
      if (result.ok) setSent(true);
      else {
        setMessage(result.message);
        setErrors(result.fieldErrors ?? {});
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const status = (key: string) => (errors[key] ? { type: "error" as const, message: errors[key] } : undefined);

  return (
    <section aria-labelledby="edit-heading" style={section}>
      <Heading level={2} id="edit-heading">
        Edit details
      </Heading>
      <Text type="supporting" as="p">
        Changes are reviewed by an admin before they apply.
      </Text>
      {message ? <Banner status="error" title={message} collapsible={false} /> : null}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextInput
          id="edit-team-name"
          label="Team name"
          value={teamName}
          onChange={setTeamName}
          isRequired
          status={status("teamName")}
        />
        <Selector
          id="edit-track"
          label="Track"
          isRequired
          value={track}
          options={TRACKS.map((t) => ({ value: t, label: t }))}
          onChange={(value) => {
            if (value) setTrack(value);
          }}
          status={status("track")}
        />
        {snapshot.members.map((m, index) => (
          <fieldset
            key={m.id}
            style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <legend style={{ marginBottom: "0.5rem" }}>
              <Text as="span">Member {index + 1}</Text>
            </legend>
            {MEMBER_FIELDS.map(({ key, label, type }) => {
              const name = memberFieldName(m.id, key);
              return (
                <TextInput
                  key={name}
                  id={`edit-${m.id}-${key}`}
                  type={type}
                  label={label}
                  value={values[name] ?? ""}
                  onChange={(value) => setValues((current) => ({ ...current, [name]: value }))}
                  isRequired
                  status={status(`members.${m.id}.${key}`)}
                />
              );
            })}
          </fieldset>
        ))}
        <Button type="submit" variant="primary" label="Send for review" isLoading={loading} isDisabled={loading} />
      </form>
    </section>
  );
}
