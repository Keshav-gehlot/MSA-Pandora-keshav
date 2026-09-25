# packages/db

The only code that talks to the database: Drizzle schema, migrations and query functions. Issues carry the
`area:db` label.

- Apps never import `drizzle-orm` or `postgres` themselves; they call functions exported from here.
- Schema changes always come with a generated migration (`drizzle-kit generate`) committed in the same pull request.
- Known issue from msa-auth, which uses the same stack: Supabase's transaction pooler (port 6543) doesn't support
  prepared statements, so `postgres.js` needs `prepare: false`, and pipelined queries hung until msa-auth disabled
  pipelining. The connection setup for Pandora is decided in the Registration and Operations spec. Don't improvise it.
