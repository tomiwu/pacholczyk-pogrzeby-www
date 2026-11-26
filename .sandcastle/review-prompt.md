# Task

Review branch `{{BRANCH}}` for issue #{{ISSUE}}. First check that the change does what the issue asks. Then make the code simpler without a change in behaviour.

## Issue

<!-- inline-start: .sandcastle/context/issue.json -->

!`mkdir -p .sandcastle/context && printf '*\n' > .sandcastle/context/.gitignore && { [ -s .sandcastle/context/issue.json ] || gh issue view {{ISSUE}} --json number,title,body,comments --jq '{number, title, body, comments: [.comments[].body]}' > .sandcastle/context/issue.json; } && head -c 15000 .sandcastle/context/issue.json && echo && echo "[Full issue: .sandcastle/context/issue.json.]"`

<!-- inline-end -->

## Branch diff

The full diff is in `.sandcastle/context/review-diff.patch` (git-ignored). Below are the summary and the first part only.

<!-- inline-start: .sandcastle/context/review-diff.patch -->

!`git diff {{TARGET_BRANCH}}...{{BRANCH}} > .sandcastle/context/review-diff.patch && echo "Full diff: .sandcastle/context/review-diff.patch ($(wc -c < .sandcastle/context/review-diff.patch) bytes)." && git diff --stat=160 {{TARGET_BRANCH}}...{{BRANCH}} | tail -n 80 | head -c 12000 && echo && git diff {{TARGET_BRANCH}}...{{BRANCH}} | head -c 40000 && echo && echo "[End of the inline part. Read the rest in .sandcastle/context/review-diff.patch.]"`

<!-- inline-end -->

## Commits on this branch

!`git log {{TARGET_BRANCH}}..{{BRANCH}} --oneline`

# Review steps

1. **Acceptance criteria first.** List each acceptance criterion of the issue. For each one, write `met` or `not met` with the file and the test that shows it. Fix each `not met` item.
2. **Bugs.** List each bug that you find (wrong logic, missed edge case, missing test, unchecked input, a secret or personal data). Fix each bug and add a test for it.
3. **Verification section.** A commit message must have `## Verification` with the command and the pasted tail of its real output (and before/after numbers for a performance issue). If it is missing or invented, run the command and add the real output in your commit.
4. **Simplify.** Remove needless complexity, duplication and comments that say what the code says. Keep behaviour the same. Follow `CLAUDE.md`.
5. Run the commands in `.sandcastle/checks.json`. Commit with a message in English (ASD-STE100) that starts with `RALPH: #{{ISSUE}} review` and contains the criteria list and the bug list.

If all criteria are met, there is no bug and the code is clean, do not commit.

The host pushes and opens the PR. Nobody but Tomasz merges. Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to.

Once complete, output <promise>COMPLETE</promise>.
