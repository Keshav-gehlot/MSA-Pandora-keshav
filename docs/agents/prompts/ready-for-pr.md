# Prompt: get my pull request ready

```
I think issue #<number> is done. Before I open (or mark ready) the pull request:
1. Run pnpm lint && pnpm typecheck && pnpm test && pnpm build and show me the result.
2. Show me `git diff origin/main...HEAD --stat` and check every file is inside the task's plan and the issue's area.
3. Look for leftover debug code, commented-out code, TODOs and comments that no longer match the code.
4. Check the plan task's checklist item by item and tell me which are done.
5. Draft the PR description from .github/pull_request_template.md: Closes #<number>, what changed, why, how I
   tested it, and leave "What I learned" for me to write in my own words.
Don't push or open the PR yourself.
```
