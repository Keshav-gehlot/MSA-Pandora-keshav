# packages/email

Every email Pandora sends (OTP codes, registration confirmations, payment decisions, notices) and the code that
sends them through Resend. Issues carry the `area:email` label.

- Templates are code in this package, never strings built inside an app.
- Add a template: create `src/templates/<flow>/<name>.tsx` exporting `{ subject, text, html }` (each takes the
  template's props), then add it to the object in `src/templates/<flow>/index.ts`. Flows never edit `registry.ts`.
  Prefix template names with the flow (`registration-received`, `admin-payment-approved`) so they can't collide.
  Apps send it with `sendEmail({ to, template: "<name>", props })`.
- Sending goes through `sendEmail`, so tests and local development can capture mail instead of sending it.
- Never log OTP codes or full email addresses.

## Environment variables

| Variable | Meaning |
|---|---|
| `MAIL_TRANSPORT` | `resend` sends for real; anything else writes to `MAIL_OUTBOX_PATH`. Must be `resend` on Vercel. |
| `MAIL_OUTBOX_PATH` | Local outbox file, one JSON line per message (default `.mail/outbox.jsonl`). |
| `RESEND_API_KEY` | Resend API key. Required on Vercel. |
| `EMAIL_FROM` | Sender address, default `MSA Pandora <pandora@recruitments.msasrm.in>`. |
| `MAIL_ALLOWLIST` | Comma-separated recipients. When set, mail to anyone else is skipped. On previews (`VERCEL_ENV=preview`) an empty list skips everything. |
