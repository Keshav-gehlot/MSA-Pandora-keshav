import { Badge, Button, Card, Heading, Text } from "@pandora/ui";
import type { ReactNode } from "react";
import { signOut } from "./sign-in-actions";
import type { PaymentStatusValue } from "./status";

type Member = { id: string; isLeader: boolean; firstName: string; lastName: string; srmEmail: string };

const stack = { display: "flex", flexDirection: "column", gap: "0.75rem" } as const;
const row = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" } as const;

export function Welcome({ firstName, teamName, track }: { firstName: string; teamName: string; track: string }) {
  return (
    <header style={stack}>
      <Heading level={1}>Welcome, {firstName}</Heading>
      <div style={row}>
        <Text as="span">{teamName}</Text>
        <Badge label={track} variant="info" />
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary" label="Sign out" />
      </form>
    </header>
  );
}

export function MembersList({ members }: { members: Member[] }) {
  return (
    <section aria-labelledby="members-heading" style={stack}>
      <Heading level={2} id="members-heading">
        Members
      </Heading>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {members.map((m) => (
          <li key={m.id}>
            <Card>
              <div style={row}>
                <Text as="span">
                  {m.firstName} {m.lastName}
                </Text>
                {m.isLeader ? <Badge label="Leader" variant="neutral" /> : null}
              </div>
              <Text type="supporting" as="p">
                {m.srmEmail}
              </Text>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PAYMENT_TEXT = {
  pending: "Waiting for an admin to verify your payment",
  approved: "Payment verified",
  declined: "Your payment needs another look: check your email",
} as const;

export function PaymentStatus({ status }: { status: PaymentStatusValue }) {
  if (status === "not_required") return null;
  return (
    <section aria-labelledby="payment-heading" style={stack}>
      <Heading level={2} id="payment-heading">
        Payment
      </Heading>
      <div style={row}>
        <Badge
          label={status === "approved" ? "Verified" : status === "pending" ? "Pending" : "Needs attention"}
          variant={status === "approved" ? "success" : status === "pending" ? "warning" : "error"}
        />
        <Text as="span">{PAYMENT_TEXT[status]}</Text>
      </div>
    </section>
  );
}

export function EventPass({ shortlisted, children }: { shortlisted: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby="pass-heading" style={stack}>
      <Heading level={2} id="pass-heading">
        Event pass
      </Heading>
      {shortlisted ? children : <Text as="p">Your event pass appears here once your team is shortlisted.</Text>}
    </section>
  );
}
