# Prompt: write a handoff note

Use at the end of every session, before switching tools, or when a session gets long. Paste the result as a
comment on the issue, starting with **Handoff**.

```
We're stopping this session. Write a handoff note for issue #<number> that someone starting a fresh session, in
any AI tool, can use to continue without re-reading everything. Use exactly these headings:

**Handoff** (date, branch name, last commit)
- Done: what is finished and verified (which tests pass).
- Next: the very next step, specific enough to start on immediately.
- Decisions: choices we made and why, including anything we tried that didn't work.
- Open questions: anything waiting on a person (and who).
- How to verify: the commands to run to see the current state.

Keep it under 20 lines. No secrets, no environment values, no real participant data.
```
