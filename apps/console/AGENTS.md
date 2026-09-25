# apps/console

The internal console at console.pandora.msasrm.in: the admin portal (payments, edit requests, notices,
shortlisting) and the staff portal (QR check-in). Issues for this app carry the `area:console` label.

- Every page except sign-in requires an authenticated admin or staff session. Never add a public page here.
- The console is excluded from search engines (`robots: noindex` in the root layout). Keep it that way.
- Business rules go in `@pandora/core`; data access goes through `@pandora/db`.
- Staff screens are used on phones at the venue, so check them at 375px wide.
- Never import from `apps/web`.
