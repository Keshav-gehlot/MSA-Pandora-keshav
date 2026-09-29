import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type PaymentDeclinedProps = {
  teamName: string;
  note?: string | null;
};

export const paymentDeclined = {
  subject: (p: PaymentDeclinedProps) => `${p.teamName}: payment needs another look`,

  text: (p: PaymentDeclinedProps) =>
    [
      `Hi ${p.teamName},`,
      "",
      "We reviewed your payment screenshot, but couldn't verify it.",
      p.note ? `Note: ${p.note}` : "",
      "",
      "Please re-scan the payment QR code and reply to this email with the new screenshot.",
    ]
      .filter((line) => line !== "")
      .join("\n"),

  html: (p: PaymentDeclinedProps) => (
    <Html>
      <Preview>{p.teamName}: payment needs another look</Preview>
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#ffffff",
        }}
      >
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Hi {p.teamName},</Text>
          <Text>We reviewed your payment screenshot, but couldn't verify it.</Text>
          {p.note && (
            <Text>
              <strong>Review note:</strong> {p.note}
            </Text>
          )}
          <Text>
            Please re-scan the payment QR code and reply to this email with the new screenshot.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
};
