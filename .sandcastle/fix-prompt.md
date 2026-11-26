# Task

You work on `{{PROJECT}}`, issue #{{ISSUE}}, branch `{{BRANCH}}`. A check failed. Fix the cause so that all checks pass.

## Check output

<!-- inline-start: the check output (run the check again for the full log) -->

```
{{CHECK_LOG}}
```

<!-- inline-end -->

# Rules

- Fix the cause. Do not remove or weaken a test. Do not add a file to a lint allow list.
- Format failure: run the formatter. Do not format by hand.
- Lighthouse failure: make the page lighter (image size, fonts, JavaScript). Do not raise the budget.
- axe failure: fix the markup. Do not disable a rule.
- An early host check failure comes from the host (the sandbox cannot run it): read the error and fix the code.
- Run all commands in `.sandcastle/checks.json`. Make one commit that starts with `RALPH: #{{ISSUE}} fix`, in English (ASD-STE100). If no commit has a `## Verification` section yet, add one with the command and its real output.
- The host pushes and opens the PR. Nobody but Tomasz merges. Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to.

When you are done, output:

<promise>COMPLETE</promise>
