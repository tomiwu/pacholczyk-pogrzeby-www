# Rules for agents in this repository

## Language
- Code, comments, docs, issues, PRs and commit messages: English, ASD-STE100 Simplified Technical English. Short sentences.
- Site copy (page text, meta titles, descriptions, FAQ, alt text, form labels): Polish, with correct diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż).

## Product facts (do not change without a PRD decision)
- Name: "Zakład Usług Pogrzebowych Pacholczyk". Owner: Filip Pacholczyk.
- Uniejów office: ul. Sienkiewicza 17, 99-210 Uniejów.
- Turek office: Plac Wojska Polskiego 10, 62-700 Turek.
- Telephones (both offices): +48 63 288 85 54 and +48 609 731 454. Service is 24 h.
- Keep these values in ONE module (`src/lib/nap.ts`) and import them. Do not invent a third address or a third phone.
- E-mail `jpacholczyk@o2.pl` is unconfirmed. Do not show it on the site and do not put it in JSON-LD until `docs/PRD.md` marks it as confirmed.
- The main goal of the site is a telephone call. Keep a sticky phone button on every view.
- The site is one page: scroll story, O nas, Usługi, FAQ and the "Zgłoszenie zgonu" form, Kontakt (two offices), map.
- The form must not send data. It shows a request to call (Polish). There is no backend in this phase.
- No analytics. No cookies. No third-party embed that sets cookies. The map is a static image or a link to OpenStreetMap.
- Never invent prices, awards or reviews. A missing fact gets a visible `TODO` marker in the copy and a line in `docs/content-todo.md`.
- Scene 1 is the nave of the Uniejów collegiate church with the fresco of the translation of the relics of St Bogumił. Never commit the source photograph of the church (unknown author).
- People in the illustrations are dark silhouettes with no faces. The hearse is a generic black Mercedes with no badge and no plate. Heaven is soft clouds and a warm sun, with no angels and no figures. A small cross is allowed. The mood is calm and respectful.

## Stack
- Next.js App Router, TypeScript strict, static export (`output: 'export'`, `trailingSlash: true`). No server code in Next.js. No API routes. No PHP.
- Pages are React Server Components. Client components only where interaction needs them (theme toggle, mobile menu, form UI, reduced-motion detection).
- Themes: light Stone Olive, dark Candle Graphite. Follow `prefers-color-scheme`. A manual toggle sets `html[data-theme]` and wins over the system preference. Tokens live in CSS custom properties (see `/workspace/pacholczyk-branding/tokens.css` until the layout issue commits them).
- Fonts: Fraunces (headings and wordmark) and Nunito Sans (body and UI), SIL OFL 1.1, latin-ext, self-hosted with `next/font/local` and `display: swap`. No Google Fonts request at runtime.
- Scroll story: CSS-only scroll-driven animations (`animation-timeline: view()`) with an IntersectionObserver fallback. Change only `transform` and `opacity`. When `prefers-reduced-motion: reduce` is set, show four still images and no animation.
- Keep the page light: LCP below 2500 ms (mobile lab). Pre-sized images in `public/img/` with width and height.
- Accessibility: WCAG 2.2 AA. Semantic HTML, one `h1` on the page, labels on all inputs, visible focus, contrast 4.5:1, target size 24x24 px, no `user-scalable=no`.

## Commands (all must pass before a commit; run `scripts/precommit.sh`)
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:schema`, `npm run test:e2e`, `npm run lighthouse`.
- Use the formatter (`npm run format`). Do not format by hand.

## Tests
- Test behaviour that a user or a crawler can see (HTML output, JSON-LD, axe results, theme tokens, the form that does not send data, `noindex` on the preview).
- No network in tests. No personal data. Invented test data only.
- Do not weaken or skip a test. Do not disable an axe rule or a lint rule to pass.

## Git
- One issue = one branch = one PR. Commit messages start with `RALPH: #<issue>`. End with `## Verification` (command and pasted real output).
- Never commit secrets. `.sandcastle/.env` is git-ignored. The loop webhook key is not in `.env`; it lives in `/workspace/pacholczyk-www-secrets/loop-webhook-key`.
- Do not edit `docs/PRD.md`, `.sandcastle/` or `.claude/`. Edit `.github/` only when the issue tells you to.
