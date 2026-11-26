# Context

You work on `{{PROJECT}}`, issue #{{ISSUE}}, branch `{{BRANCH}}`. Do only this issue.

The host writes the full issue (body and comments) to `.sandcastle/context/issue.json` (git-ignored). If the text below is cut, read that file.

<!-- inline-start: .sandcastle/context/issue.json -->

!`mkdir -p .sandcastle/context && printf '*\n' > .sandcastle/context/.gitignore && gh issue view {{ISSUE}} --json number,title,body,comments --jq '{number, title, body, comments: [.comments[].body]}' > .sandcastle/context/issue.json && head -c 15000 .sandcastle/context/issue.json && echo && echo "[Full issue: .sandcastle/context/issue.json ($(wc -c < .sandcastle/context/issue.json) bytes).]"`

<!-- inline-end -->

## Recent commits

!`git log --oneline -10`

# Task

1. Read the issue and its acceptance criteria. Read only the `docs/PRD.md` sections that the issue names. Read `CLAUDE.md`.
2. Read the source files and the tests that the change touches.
3. Use Red-Green-Refactor: a failing test first, then the code.
4. Run all commands in `.sandcastle/checks.json`. Fix all failures.
5. Make one commit. Start the message with `RALPH: #{{ISSUE}}`. Write the task, the key decisions and the files changed.
6. End the commit message with `## Verification`: the exact command, and a fenced block with the last lines of its real output (copy them, do not write them). For a performance issue add a before/after table with the measured numbers.

# Facts that the code does not show

- One-page static site for the funeral home Zakład Usług Pogrzebowych Pacholczyk (Uniejów and Turek). Site copy is POLISH. Code, comments, commits and docs are English (ASD-STE100).
- Do not invent facts. A missing fact gets a visible `TODO` marker and a line in `docs/content-todo.md`.
- NAP (single module `src/lib/nap.ts`): name "Zakład Usług Pogrzebowych Pacholczyk"; owner Filip Pacholczyk; Uniejów: ul. Sienkiewicza 17, 99-210 Uniejów; Turek: Plac Wojska Polskiego 10, 62-700 Turek; phones +48 63 288 85 54 and +48 609 731 454 (both offices); 24 h service. Do not put the e-mail in the site or in JSON-LD until `docs/PRD.md` marks it as confirmed.
- No analytics. No cookies. No form data sending. The "Zgłoszenie zgonu" form only shows a request to call. No PHP and no backend in this phase.
- Tests do not use the network. Use fakes and invented data. No secrets and no personal data anywhere.
- Never commit the source photograph of the Uniejów collegiate church (unknown author).
- The host pushes and opens the PR. Nobody but Tomasz merges. Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to. If the CI must change, describe the change with `gh issue comment {{ISSUE}}`.
- If you cannot continue, write the reason with `gh issue comment {{ISSUE}}`.

When you are done, output:

<promise>COMPLETE</promise>
