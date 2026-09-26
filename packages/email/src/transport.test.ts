import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const { getTransport } = await import("./send");
const { resendTransport } = await import("./transport");

const ENV_KEYS = ["VERCEL", "MAIL_TRANSPORT", "RESEND_API_KEY"] as const;
let saved: Partial<Record<(typeof ENV_KEYS)[number], string>>;
beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resendSend.mockReset();
});

const msg = { from: "f", to: "a@srmist.edu.in", subject: "s", html: "<p>h</p>", text: "t" };

describe("resendTransport", () => {
  it("returns Resend's id", async () => {
    resendSend.mockResolvedValue({ data: { id: "re_1" }, error: null });
    expect(await resendTransport("re_test").send(msg)).toEqual({ id: "re_1" });
  });
  it("throws Resend's error message", async () => {
    resendSend.mockResolvedValue({ data: null, error: { message: "bad from" } });
    await expect(resendTransport("re_test").send(msg)).rejects.toThrow("bad from");
  });
  it("throws when Resend returns neither an error nor an id", async () => {
    resendSend.mockResolvedValue({ data: null, error: null });
    await expect(resendTransport("re_test").send(msg)).rejects.toThrow("Resend returned no id");
  });
});

describe("getTransport", () => {
  const onVercelError = "MAIL_TRANSPORT=resend and RESEND_API_KEY must be set on Vercel";

  it("falls back to the file transport off Vercel", () => {
    expect(() => getTransport()).not.toThrow();
  });
  it("refuses the file transport on Vercel", () => {
    process.env.VERCEL = "1";
    expect(() => getTransport()).toThrow(onVercelError);
    process.env.MAIL_TRANSPORT = "file";
    expect(() => getTransport()).toThrow(onVercelError);
  });
  it("refuses Resend without an API key on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.MAIL_TRANSPORT = "resend";
    expect(() => getTransport()).toThrow(onVercelError);
    process.env.RESEND_API_KEY = "";
    expect(() => getTransport()).toThrow(onVercelError);
  });
  it("uses Resend on Vercel when it's configured", async () => {
    process.env.VERCEL = "1";
    process.env.MAIL_TRANSPORT = "resend";
    process.env.RESEND_API_KEY = "re_test";
    resendSend.mockResolvedValue({ data: { id: "re_2" }, error: null });
    expect(await getTransport().send(msg)).toEqual({ id: "re_2" });
  });
});
