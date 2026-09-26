# Prompt: a check failed on my pull request

```
A check failed on my pull request for issue #<number>. Here is the failing output:
<paste the failing step's log, with any secrets or URLs removed>

First decide whether my change caused it: compare the failing files/tests with `git diff origin/main...HEAD
--name-only` and explain your reasoning. If my change caused it, explain the root cause before fixing it, then fix
it and re-run exactly what CI runs (pnpm lint && pnpm typecheck && pnpm test && pnpm build). If it isn't my change,
don't work around it: tell me what's failing and why you think it's unrelated, so I can tell Ojas. Never weaken or
skip a test to make it pass.
```
