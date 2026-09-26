# Prompt: respond to review comments

```
My pull request for issue #<number> got review comments:
<paste the comments>

For each comment: explain what the reviewer is asking and why it matters, make the fix, and verify it with
pnpm lint && pnpm typecheck && pnpm test && pnpm build. After I push, draft a short reply for each comment that says
what changed and names the commit. If you disagree with a comment, explain why to me instead of changing the code,
and I'll discuss it with the reviewer.
```
