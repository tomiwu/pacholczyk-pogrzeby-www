# pacholczyk-pogrzeby-www

Business-card website of **Zakład Usług Pogrzebowych Pacholczyk** in Uniejów and Turek, Poland.

- **Visibility: PUBLIC.** Licence: all rights reserved. No person may copy, modify or distribute this work without written permission of the owner. This is not an MIT licence and not any other open-source licence.
- Stack: Next.js (App Router, static export) + TypeScript. Preview: GitHub Pages with `noindex` until launch. There is no production domain yet.
- Product requirements: [docs/PRD.md](docs/PRD.md). Terms: [GLOSSARY.md](GLOSSARY.md). Agent rules: [CLAUDE.md](CLAUDE.md).
- Work flow: GitHub issues with the label `Sandcastle` -> Sandcastle loop on the box (Claude Code in Podman) -> pull request -> all CI checks green -> label `needs-validation` -> Tomasz gives the OK -> squash merge. The loop never merges.
- Local gate before each commit (after the scaffold exists): `scripts/precommit.sh`.
- Site copy is Polish. Code, docs, issues, PRs and commits are English (ASD-STE100).
