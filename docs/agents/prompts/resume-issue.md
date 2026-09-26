# Prompt: resume an issue (new session or a different tool)

```
I'm continuing issue #<number> (task <task-id>) in MSA Pandora in a fresh session. Follow AGENTS.md.

Here is the latest handoff note from the issue:
<paste the most recent "Handoff" comment>

And the task brief:
<paste `pnpm agent:brief <task-id>` output, or let the tool read AGENTS.md and the plan section>

Before changing anything: check out the branch named in the handoff (git fetch origin, then git switch <branch>),
run the "How to verify" commands, and tell me whether the current state matches the note. Then explain the next
step and wait for me to say go. Keep explaining everything as you work.
```
