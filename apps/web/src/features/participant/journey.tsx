import { Badge, Heading, Text } from "@pandora/ui";
import type { PaymentStatusValue, ShortlistStatusValue } from "./status";

type Props = {
  shortlistStatus: ShortlistStatusValue;
  paymentStatus: PaymentStatusValue;
  episodeOpen: boolean;
};

type Variant = "success" | "warning" | "neutral";

const SHORTLIST: Record<Props["shortlistStatus"], { text: string; variant: Variant }> = {
  pending: { text: "Waiting for results", variant: "warning" },
  shortlisted: { text: "Shortlisted", variant: "success" },
  not_shortlisted: { text: "Not shortlisted this time", variant: "neutral" },
};

export function Journey({ shortlistStatus, paymentStatus, episodeOpen }: Props) {
  const waiting = paymentStatus === "pending" || paymentStatus === "declined";
  const episodeZero: { text: string; variant: Variant } = waiting
    ? { text: "Waiting for verification", variant: "warning" }
    : episodeOpen
      ? { text: "Open", variant: "success" }
      : { text: "Closed", variant: "neutral" };

  const steps: Array<{ name: string; text: string; variant: Variant }> = [
    { name: "Registration", text: "Done", variant: "success" },
    { name: "Shortlisting", ...SHORTLIST[shortlistStatus] },
    { name: "Episode 0", ...episodeZero },
    { name: "Episodes 1 to 3", text: "Locked until the event", variant: "neutral" },
  ];

  return (
    <section aria-labelledby="journey-heading" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Heading level={2} id="journey-heading">
        Your journey
      </Heading>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {steps.map((step) => (
          <li key={step.name} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <Text as="span">{step.name}</Text>
            <Badge label={step.text} variant={step.variant} />
          </li>
        ))}
      </ol>
    </section>
  );
}
