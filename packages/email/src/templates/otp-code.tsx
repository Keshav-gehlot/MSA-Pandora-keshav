import { OTP } from "@pandora/core";
import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type OtpCodeProps = { code: string; purpose: "registration" | "participant_sign_in" | "staff_sign_in" };

const PURPOSE_LABEL: Record<OtpCodeProps["purpose"], string> = {
  registration: "registration",
  participant_sign_in: "sign-in",
  staff_sign_in: "staff sign-in",
};

export const otpCode = {
  subject: (p: OtpCodeProps) => `${p.code} is your MSA Pandora ${PURPOSE_LABEL[p.purpose]} code`,
  text: (p: OtpCodeProps) =>
    `Your MSA Pandora ${PURPOSE_LABEL[p.purpose]} code is ${p.code}. It expires in ${OTP.ttlMinutes} minutes. If you didn't ask for it, ignore this email.`,
  html: (p: OtpCodeProps) => (
    <Html>
      <Preview>{`Your code is ${p.code}`}</Preview>
      <Body style={{ fontFamily: "system-ui, sans-serif", backgroundColor: "#ffffff" }}>
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Your {PURPOSE_LABEL[p.purpose]} code:</Text>
          <Text style={{ fontSize: "32px", fontWeight: 600, letterSpacing: "0.2em" }}>{p.code}</Text>
          <Text>It expires in {OTP.ttlMinutes} minutes. If you didn&apos;t ask for it, ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  ),
};
