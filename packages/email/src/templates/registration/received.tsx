import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type RegistrationReceivedProps = {
  teamName: string;
  track: string;
  memberNames: string[];
  paymentPending: boolean;
};

export const registrationReceived = {
  subject: (p: RegistrationReceivedProps) =>
    p.paymentPending
      ? `We've received ${p.teamName}'s registration`
      : `${p.teamName} is registered for MSA Pandora`,

  text: (p: RegistrationReceivedProps) => {
    const status = p.paymentPending
      ? "Your registration has been received and your payment is under review."
      : "Your team is successfully registered for MSA Pandora.";

    return [
      `Team: ${p.teamName}`,
      `Track: ${p.track}`,
      "",
      "Members:",
      ...p.memberNames.map((name) => `- ${name}`),
      "",
      status,
      "",
      "What happens next:",
      "Your team will be considered for shortlisting through Episode 0.",
      "Use your SRM email to sign in to the MSA Pandora site for updates.",
    ].join("\n");
  },

  html: (p: RegistrationReceivedProps) => (
    <Html>
      <Preview>
        {p.paymentPending
          ? `We've received ${p.teamName}'s registration`
          : `${p.teamName} is registered for MSA Pandora`}
      </Preview>

      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#ffffff",
        }}
      >
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>

          <Text>
            {p.paymentPending
              ? "Your registration has been received and your payment is under review."
              : "Your team is successfully registered for MSA Pandora."}
          </Text>

          <Text>
            <strong>Team:</strong> {p.teamName}
          </Text>

          <Text>
            <strong>Track:</strong> {p.track}
          </Text>

          <Text>
            <strong>Members:</strong>
          </Text>

          {p.memberNames.map((name) => (
            <Text key={name}>• {name}</Text>
          ))}

          <Text>
            <strong>What happens next:</strong>
          </Text>

          <Text>
            Your team will be considered for shortlisting through Episode 0.
            Use your SRM email to sign in to the MSA Pandora site for updates.
          </Text>
        </Container>
      </Body>
    </Html>
  ),
};