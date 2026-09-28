import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { registrationReceived } from "./received";

const props = {
  teamName: "Null Pointers",
  track: "Track A",
  memberNames: ["Asha Rao", "Ben Paul", "Chitra N"],
  paymentPending: false,
};

describe("registration-received", () => {
  it("confirms a registration when no payment is due", async () => {
    expect(registrationReceived.subject(props)).toBe(
      "Null Pointers is registered for MSA Pandora",
    );
    const text = registrationReceived.text(props);

    for (const s of ["Null Pointers", "Track A", "Asha Rao", "Ben Paul", "Chitra N"]) {
      expect(text).toContain(s);
    }

    expect(await render(registrationReceived.html(props))).toContain("Null Pointers");
  });

  it("says the payment is under review when it is", () => {
    const pending = { ...props, paymentPending: true };

    expect(registrationReceived.subject(pending)).toBe(
      "We've received Null Pointers's registration",
    );
    expect(registrationReceived.text(pending)).toContain("payment");
  });
});