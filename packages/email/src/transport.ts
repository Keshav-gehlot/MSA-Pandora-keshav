import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Resend } from "resend";

export type MailMessage = { from: string; to: string; subject: string; html: string; text: string };
export type MailTransport = { send(msg: MailMessage): Promise<{ id: string }> };

// Local development and tests: one JSON line per message instead of sending anything.
export function fileTransport(path: string): MailTransport {
  return {
    async send(msg) {
      mkdirSync(dirname(path), { recursive: true });
      const id = crypto.randomUUID();
      appendFileSync(path, JSON.stringify({ id, at: new Date().toISOString(), ...msg }) + "\n");
      return { id };
    },
  };
}

export function resendTransport(apiKey: string): MailTransport {
  const resend = new Resend(apiKey);
  return {
    async send(msg) {
      const { data, error } = await resend.emails.send(msg);
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Resend returned no id");
      return { id: data.id };
    },
  };
}
