import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type EditDecidedProps = {
  teamName: string;
  approved: boolean;
  note: string | null;
};

export const editDecided = {
  subject: (p: EditDecidedProps) =>
    p.approved
      ? `${p.teamName}: change request approved`
      : `${p.teamName}: change request declined`,

  text: (p: EditDecidedProps) =>
    [
      `Hi ${p.teamName},`,
      "",
      p.approved
        ? "Your team's change request has been reviewed and approved!"
        : "Your team's change request has been reviewed and declined.",
      p.note ? `Note: ${p.note}` : "",
      "",
      "Sign in to the MSA Pandora site for team updates and announcements.",
    ]
      .filter((line) => line !== "")
      .join("\n"),

  html: (p: EditDecidedProps) => (
    <Html>
      <Preview>
        {p.approved
          ? `${p.teamName}: change request approved`
          : `${p.teamName}: change request declined`}
      </Preview>
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#ffffff",
        }}
      >
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Hi {p.teamName},</Text>
          <Text>
            {p.approved
              ? "Your team's change request has been reviewed and approved!"
              : "Your team's change request has been reviewed and declined."}
          </Text>
          {p.note && (
            <Text>
              <strong>Review note:</strong> {p.note}
            </Text>
          )}
          <Text>
            Sign in to the MSA Pandora site for team updates and announcements.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
};
