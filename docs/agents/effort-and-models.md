# Choosing effort and model

Every issue has an effort label. It tells you how much model to throw at it: using the strongest model for a
button colour wastes your quota; using the cheapest one for sign-in security wastes your afternoon.

## The three levels

| Label | Typical tasks | Model tier | Thinking / reasoning |
|---|---|---|---|
| `effort:light` | Copy and styling changes, turning a plan's given tests into a file, small docs, renaming | Your tool's **fast, cheap** model | Low or off |
| `effort:standard` | Implementing a planned task, building a screen from a checklist, writing queries with given tests | Your tool's **default capable** model | Normal |
| `effort:deep` | Sign-in, sessions, anything with transactions or concurrency, migrations, security, debugging something you don't understand | Your tool's **strongest** model | High |

Tool names change often, so this guide uses tiers. In any tool, "fast/cheap" is the small or "mini/flash/haiku"
option, "default" is the one it picks for you, and "strongest" is the top model with extended reasoning turned on.

## Escalate, don't loop

If the same approach has failed twice, stop. Ask the agent for a handoff note (`prompts/handoff.md`), start a
**fresh session one tier up**, and paste the note in. A fresh session with a clear note beats a long, confused one.

## Keep sessions small and focused

- **One issue per session.** Don't carry a registration session into a dashboard task.
- **Start from the brief, not from the repo.** Run `pnpm agent:brief <task-id>` and paste its output, or point your
  agent at the plan section. Don't ask an agent to "look around the codebase": the plan already lists every file.
- **Start fresh when the session gets long.** When your tool warns about context, or answers start contradicting
  earlier ones, write a handoff note and open a new session.
- **Switching tools is fine.** Everything the next tool needs is in the repo and the issue's handoff comments.
- **Show, don't describe.** Paste the exact error, the exact failing test output, or the exact file path.

## Asking well

Start from a prompt in `docs/agents/prompts/`. A good request names the issue, the plan task, the files involved,
and what "done" looks like, and asks the agent to explain before it changes anything.
