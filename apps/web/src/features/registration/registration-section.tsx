import { isPaymentEnabled } from "@pandora/core";

import { RegistrationForm } from "./registration-form";

export function RegistrationSection() {
  const paymentEnabled = isPaymentEnabled(process.env.PAYMENT_ENABLED);

  return <RegistrationForm paymentEnabled={paymentEnabled} />;
}