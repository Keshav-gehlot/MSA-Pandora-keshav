"use client";

import { Banner, Button, Heading, Text, TextArea, TextInput } from "@pandora/ui";
import { useState, type FormEvent } from "react";
import { submitEpisodeZero } from "./dashboard-actions";
import type { PaymentStatusValue } from "./status";

type Props = {
  initial: { repoUrl: string; demoUrl: string; notes: string } | null;
  savedAt: string | null;
  episodeOpen: boolean;
  paymentStatus: PaymentStatusValue;
};

export function EpisodeZero({ initial, savedAt, episodeOpen, paymentStatus }: Props) {
  const [repoUrl, setRepoUrl] = useState(initial?.repoUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(initial?.demoUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const blocked =
    paymentStatus === "pending"
      ? "Your registration is being verified. You can submit once an admin approves your payment"
      : paymentStatus === "declined"
        ? "Your payment needs another look: check your email"
        : !episodeOpen
          ? "Episode 0 is closed"
          : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setErrors({});
    setSaved(false);

    const data = new FormData();
    data.set("repoUrl", repoUrl);
    data.set("demoUrl", demoUrl);
    data.set("notes", notes);

    try {
      const result = await submitEpisodeZero(data);
      if (result.ok) setSaved(true);
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
    <section aria-labelledby="ep0-heading" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Heading level={2} id="ep0-heading">
        Episode 0 submission
      </Heading>
      {blocked ? <Banner status="warning" title={blocked} collapsible={false} /> : null}
      {message ? <Banner status="error" title={message} collapsible={false} /> : null}
      {saved ? <Banner status="success" title="Submission saved." collapsible={false} /> : null}
      {savedAt ? (
        <Text type="supporting" as="p">
          Last saved {savedAt}
        </Text>
      ) : null}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextInput
          id="ep0-repo"
          label="Repository URL"
          placeholder="https://github.com/your-team/project"
          value={repoUrl}
          onChange={setRepoUrl}
          isRequired
          isDisabled={blocked !== null}
          status={status("repoUrl")}
        />
        <TextInput
          id="ep0-demo"
          label="Demo URL (optional)"
          placeholder="https://"
          value={demoUrl}
          onChange={setDemoUrl}
          isDisabled={blocked !== null}
          status={status("demoUrl")}
        />
        <TextArea
          id="ep0-notes"
          label="Notes (optional)"
          value={notes}
          onChange={setNotes}
          maxLength={2000}
          rows={5}
          isDisabled={blocked !== null}
          status={status("notes")}
        />
        <Button
          type="submit"
          variant="primary"
          label={initial ? "Update submission" : "Submit"}
          isLoading={loading}
          isDisabled={loading || blocked !== null}
        />
      </form>
    </section>
  );
}
