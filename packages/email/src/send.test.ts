import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sendEmail } from "./send";
import { fileTransport, type MailMessage, type MailTransport } from "./transport";

const captured: MailMessage[] = [];
const capture: MailTransport = { async send(msg) { captured.push(msg); return { id: `t${captured.length}` }; } };

afterEach(() => {
  captured.length = 0;
  delete process.env.MAIL_ALLOWLIST;
  delete process.env.VERCEL_ENV;
});

describe("sendEmail", () => {
  it("renders the OTP email with the code in subject, html and text", async () => {
    const r = await sendEmail({ to: "m1@srmist.edu.in", template: "otp-code", props: { code: "042917", purpose: "registration" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "t1" });
    const msg = captured[0]!;
    expect(msg.to).toBe("m1@srmist.edu.in");
    expect(msg.from).toBe("MSA Pandora <pandora@recruitments.msasrm.in>");
    expect(msg.subject).toBe("042917 is your MSA Pandora registration code");
    expect(msg.html).toContain("042917");
    expect(msg.text).toContain("042917");
    expect(msg.text).toContain("10 minutes");
  });

  it("skips recipients outside MAIL_ALLOWLIST", async () => {
    process.env.MAIL_ALLOWLIST = "ok@srmist.edu.in";
    const r = await sendEmail({ to: "other@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "participant_sign_in" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "skipped-not-allowlisted" });
    expect(captured).toHaveLength(0);
  });

  it("skips every recipient on a preview deployment when MAIL_ALLOWLIST is empty", async () => {
    process.env.VERCEL_ENV = "preview";
    const r = await sendEmail({ to: "m1@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "registration" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "skipped-not-allowlisted" });
    process.env.MAIL_ALLOWLIST = " ";
    expect(await sendEmail({ to: "m1@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "registration" } }, { transport: capture })).toEqual({ ok: true, id: "skipped-not-allowlisted" });
    expect(captured).toHaveLength(0);
  });

  it("sends to allowlisted recipients on a preview deployment", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.MAIL_ALLOWLIST = "ok@srmist.edu.in";
    const r = await sendEmail({ to: "OK@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "registration" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "t1" });
  });

  it("returns an error instead of throwing when the transport fails", async () => {
    const broken: MailTransport = { async send() { throw new Error("smtp down"); } };
    const r = await sendEmail({ to: "a@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "staff_sign_in" } }, { transport: broken });
    expect(r).toEqual({ ok: false, error: "smtp down" });
  });
});

describe("fileTransport", () => {
  it("appends one JSON line per message", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "mail-")), "outbox.jsonl");
    const t = fileTransport(file);
    await t.send({ from: "f", to: "a", subject: "s1", html: "<p>1</p>", text: "1" });
    await t.send({ from: "f", to: "b", subject: "s2", html: "<p>2</p>", text: "2" });
    const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.subject)).toEqual(["s1", "s2"]);
  });
});
