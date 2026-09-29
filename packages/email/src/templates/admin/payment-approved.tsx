import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type PaymentApprovedProps = {
  teamName: string;
};

export const paymentApproved = {
  subject: (p: PaymentApprovedProps) => `${p.teamName}: registration confirmed`,

  text: (p: PaymentApprovedProps) =>
    [
      `Hi ${p.teamName},`,
      "",
      "Your registration payment has been reviewed and approved!",
      "Your team's registration is confirmed for MSA Pandora.",
      "",
      "Use your SRM email to sign in to the MSA Pandora site for team updates and announcements.",
    ].join("\n"),

  html: (p: PaymentApprovedProps) => (
    <Html>
      <Preview>{p.teamName}: registration confirmed</Preview>
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#ffffff",
        }}
      >
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Hi {p.teamName},</Text>
          <Text>Your registration payment has been reviewed and approved!</Text>
          <Text>Your team's registration is confirmed for MSA Pandora.</Text>
          <Text>
            Use your SRM email to sign in to the MSA Pandora site for team updates and announcements.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
};
