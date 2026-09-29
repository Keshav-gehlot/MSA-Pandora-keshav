import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { paymentApproved } from "./payment-approved";
import { paymentDeclined } from "./payment-declined";

describe("admin payment email templates", () => {
  it("renders approved email with expected subject and content", async () => {
    const props = { teamName: "Alpha" };
    expect(paymentApproved.subject(props)).toBe("Alpha: registration confirmed");

    const text = paymentApproved.text(props);
    expect(text).toContain("Alpha");
    expect(text).toContain("registration payment has been reviewed and approved");

    const html = await render(paymentApproved.html(props));
    expect(html).toContain("Alpha");
    expect(html).toContain("MSA Pandora");
    expect(html).toContain("registration payment has been reviewed and approved");
  });

  it("renders declined email with expected subject and note in text", async () => {
    const props = { teamName: "Alpha", note: "Blurry screenshot" };
    expect(paymentDeclined.subject(props)).toBe("Alpha: payment needs another look");

    const text = paymentDeclined.text(props);
    expect(text).toContain("Alpha");
    expect(text).toContain("Blurry screenshot");
    expect(text).toContain("re-scan the payment QR code");
    expect(text).toContain("reply to this email with the new screenshot");

    const html = await render(paymentDeclined.html(props));
    expect(html).toContain("Alpha");
    expect(html).toContain("Blurry screenshot");
    expect(html).toContain("MSA Pandora");
  });
});
