# Resend

**What it is.** An email-sending service with a simple API. You send an email with one function call and see
deliveries and bounces in its dashboard.

**Why here.** Pandora sends OTP codes, registration confirmations and payment decisions, and those must actually
arrive. msa-auth already sends through Resend.

**Instead of.** Sending through a Gmail account over SMTP: rate-limited, often lands in spam, and one shared password.

**In this repo.** Only `packages/email` talks to Resend. Apps call its functions.

**Read next.** https://resend.com/docs/introduction
