"use client";

import { Badge, Banner, Button, Card, Heading, Text } from "@pandora/ui";
import { useState } from "react";
import { markRead } from "./dashboard-actions";

export type NoticeItem = { id: string; title: string; body: string; createdAt: string; read: boolean };

export function Notices({ notices, unreadCount }: { notices: NoticeItem[]; unreadCount: number }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRead(id: string) {
    setPending(id);
    setError(null);
    try {
      const result = await markRead(id);
      if (!result.ok) setError(result.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="notices-heading" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Heading level={2} id="notices-heading">
          Notices
        </Heading>
        {unreadCount > 0 ? <Badge label={`${unreadCount} unread`} variant="info" /> : null}
      </div>
      {error ? <Banner status="error" title={error} collapsible={false} /> : null}
      {notices.length === 0 ? <Text as="p">No notices yet.</Text> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {notices.map((n) => (
          <li key={n.id}>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                  <Text as="span">{n.title}</Text>
                  {n.read ? null : <Badge label="Unread" variant="info" />}
                </div>
                <Text as="p">{n.body}</Text>
                <Text type="supporting" as="p">
                  {n.createdAt}
                </Text>
                {n.read ? null : (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      label="Mark as read"
                      isLoading={pending === n.id}
                      isDisabled={pending !== null}
                      onClick={() => void handleRead(n.id)}
                    />
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
