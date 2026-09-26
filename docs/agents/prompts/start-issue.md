# Prompt: start an issue

Use at the start of a fresh session on a new issue. First run `pnpm agent:brief <task-id>` (for example
`pnpm agent:brief A2`) and paste its output right after this prompt, or, in a tool that can read the repo, let it
read the files named below.

```
I'm starting issue #<number> (task <task-id>) in MSA Pandora. I'm learning this stack, so explain everything you do
before you do it: what, why, what the alternatives were, and how I can check it. Over-explaining is fine.

Follow the session protocol in AGENTS.md exactly:
1. Orient first and change nothing yet: read AGENTS.md, the AGENTS.md of every folder this task touches, the plan
   section for this task, and any handoff comments on the issue. Then tell me in plain words what we're building,
   which files you expect to create or change (check they're all allowed by the plan and the issue's area), and what
   the effort label means for this session.
2. Wait for me to say go.
3. Where the plan gives tests, write them first and show me them failing before writing the code.
4. Verify with: pnpm lint && pnpm typecheck && pnpm test && pnpm build.
5. At the end, walk me through the diff, ask me a few questions to check I understood, and write a handoff note.

Stop and ask me before adding a dependency, changing the schema, changing anything another flow uses, editing
config or CI, or touching any file outside the task. Never read or print .env files.

<paste the agent:brief output here>
```
