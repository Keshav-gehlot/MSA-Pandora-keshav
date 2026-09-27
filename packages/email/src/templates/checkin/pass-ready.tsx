import { Body, Container, Heading, Html, Link, Preview, Text } from "@react-email/components";

export type PassReadyProps = {
  firstName: string;
  teamName: string;
  dashboardUrl: string;
};

export const passReady = {
  subject: (p: PassReadyProps) => {
    void p;
    return "Your MSA Pandora event pass is ready";
  },
  text: (p: PassReadyProps) =>
    `Hi ${p.firstName},\n\nYour team ${p.teamName} is shortlisted and your event pass for MSA Pandora is ready.\n\nView your pass on your dashboard:\n${p.dashboardUrl}\n\nShow this pass at the entrance on event day.`,
  html: (p: PassReadyProps) => (
    <Html>
      <Preview>Your MSA Pandora event pass is ready</Preview>
      <Body style={{ fontFamily: "system-ui, sans-serif", backgroundColor: "#ffffff", color: "#1a1a1a" }}>
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Hi {p.firstName},</Text>
          <Text>
            Your team <strong>{p.teamName}</strong> is shortlisted and your event pass for MSA Pandora is ready.
          </Text>
          <Text>
            <Link href={p.dashboardUrl} style={{ color: "#0066cc", textDecoration: "underline" }}>
              View your event pass on your dashboard
            </Link>
          </Text>
          <Text style={{ fontSize: "14px", color: "#666666" }}>
            Show this pass at the entrance on event day.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
};
