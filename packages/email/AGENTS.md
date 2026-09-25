# packages/email

Every email Pandora sends (OTP codes, registration confirmations, payment decisions, notices) and the code that
sends them through Resend. Issues carry the `area:email` label.

- Templates are code in this package, never strings built inside an app.
- Sending goes through one function so tests and local development can capture mail instead of sending it.
- Never log OTP codes or full email addresses.
