# PRD: pacholczyk-pogrzeby-www

Status: approved by Tomasz Wujec on 2026-11-26 (grill in the bot "Strona Pogrzebowa Pacholczyk"; branding accepted).
Owner bot: Strona Pogrzebowa Pacholczyk. Other bots do not touch this repository.

## 1. Problem

Zakład Usług Pogrzebowych Pacholczyk (owner Filip Pacholczyk) needs a simple, calm, public business-card website in Polish.
The site must help a person in grief call the funeral home quickly, at any hour.
The site must show two offices (Uniejów and Turek) and a respectful visual story.

## 2. Goal

A fast, accessible, one-page static site.
The main action is a telephone call (sticky phone button).
A short scroll story leads to the sections O nas, Usługi, FAQ, a "Zgłoszenie zgonu" form (UI only) and Kontakt with a map.
Preview first on GitHub Pages with `noindex`. There is no production domain yet.

## 3. Scope

One page (`/`), Polish copy, mobile first:

1. Scroll story of about four screens:
   - Scene 1: nave of the Uniejów collegiate church (Kolegiata). The fresco of the translation of the relics of St Bogumił is large and readable (procession from the castle, over the Warta river, to the red-brick church). A coffin stands in the central aisle.
   - Scene 2: bearers (dark silhouettes, no faces) carry the coffin into a generic black Mercedes hearse (no badge, no plate).
   - Scene 3: the hearse drives to a cemetery. A funeral is visible in the background (silhouettes only).
   - Scene 4: heaven — soft clouds and a warm sun. No angels and no figures. A small cross is allowed.
2. O nas.
3. Usługi.
4. FAQ and the "Zgłoszenie zgonu" form UI. The form does not send data. It shows a request to call.
5. Kontakt: Uniejów office and Turek office, both telephone numbers, 24 h service.
6. Map: a static image or a link to OpenStreetMap. No embed that sets cookies.
7. Sticky phone button on every view. Theme toggle (light / dark).

Out of scope for this phase: a real domain or DNS change, analytics, cookies, a form backend, a booking or shop system, an English version.

Later (backlog issue, no `Sandcastle` label): store form data in Supabase and notify Filip.

## 4. Acceptance criteria

1. Lab LCP on `/` is below 2500 ms (Lighthouse CI, mobile preset, static output).
2. WCAG 2.2 AA: axe-core (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) finds 0 violations on `/` at 390x844 and 1280x800. No `user-scalable=no`. Visible focus. Alt text on every image. Contrast at least 4.5:1 for text.
3. NAP is the same on the page and in JSON-LD: name, owner, two offices, two telephones, 24 h. No unconfirmed e-mail.
4. JSON-LD: two `FuneralHome` objects (one per office). `FAQPage` when the FAQ section exists.
5. The preview emits `noindex` (meta robots and a restrictive `robots.txt`) until Tomasz launches the site.
6. The form does not send data and makes no network request. It shows a Polish request to call.
7. No analytics and no cookies. No request to a third-party origin that sets cookies.
8. `prefers-reduced-motion: reduce` shows four still images and no scroll animation.
9. Light theme is Stone Olive. Dark theme is Candle Graphite. The site follows `prefers-color-scheme` and offers a manual toggle.

## 5. Decisions (veto allowed)

| ID | Decision | Reason |
| --- | --- | --- |
| PS1 | Repository `tomiwu/pacholczyk-pogrzeby-www`. | Approved 2026-11-26. |
| PS2 | Public repository. Licence: all rights reserved (not MIT). The README states this. | Approved 2026-11-26. Business-card site with public contact data only. |
| PS3 | Fine-grained PAT for this repo only (Contents, Issues, Pull requests, Workflows, Administration, read/write). Only in `.sandcastle/.env` on the box. Requested later through a masked field. Not present in this commit. | code-rules.md / project-blueprint. The box `GH_TOKEN` is not enough for the loop. |
| PS4 | Reuse the existing `CLAUDE_CODE_OAUTH_TOKEN` from the hotel loop. The loop webhook sender key is generated on the box and stored in `/workspace/pacholczyk-www-secrets/loop-webhook-key` (mode 600), not in `.sandcastle/.env`. No other secrets in this phase. | Approved 2026-11-26. |
| PS5 | Next.js 16.4.6 App Router, static export (`output: 'export'`, `trailingSlash: true`), React 19.3.1, TypeScript 6.0.3, ESLint 9.39.5 + jsx-a11y 6.10.2, Prettier 3.10.1, Vitest 5.1.2, Playwright 1.65.1 + axe 4.14.1, Lighthouse CI 0.16.1. Exact versions match `gosciniec-uniejow-www`. CSS-only scroll-driven animations (`animation-timeline: view()`) plus an IntersectionObserver fallback. Change only `transform` and `opacity`. `prefers-reduced-motion` shows four still images. No GSAP. No PHP. | Approved 2026-11-26. Shared-hosting constraints do not apply yet; GitHub Pages serves static files. |
| PS6 | Required CI jobs: `format`, `lint`, `typecheck`, `test`, `build`, `schema`, `e2e-a11y`, `lighthouse`. All are required in branch protection. No redirects job (there is no old site). No "skip if missing" step. | Approved 2026-11-26. |
| T1 | Preview on GitHub Pages with `noindex` until launch. No real domain and no DNS change without Tomasz's words. | Approved 2026-11-26. |
| T2 | "Zgłoszenie zgonu" form UI and FAQ now, with no data sending (show a request to call). Later backlog: Supabase storage and a notify step for Filip. | Approved 2026-11-26. |
| T3 | No analytics. No cookies. | Approved 2026-11-26. |
| Q1 | Main goal: a telephone call. Sticky phone button. | Approved 2026-11-26. |
| Q2 | One page: scroll story, O nas, Usługi, FAQ + form, Kontakt (two offices), map. | Approved 2026-11-26. |
| Q3 | AI-painted illustrations in layers for CSS parallax. | Approved 2026-11-26. |
| Q4 | Calm, respectful mood. A small cross is allowed. Heaven is soft clouds and a warm sun, with no angels and no figures. | Approved 2026-11-26. |
| Q5 | People are dark silhouettes with no faces. | Approved 2026-11-26. |
| Q6 | Generic black Mercedes hearse, no badge and no plate. | Approved 2026-11-26. |
| Q7 | Mobile first. The story is about four screens tall. | Approved 2026-11-26. |
| D1 | Merge rule: the loop never merges. A green PR gets the label `needs-validation`. Tomasz gives the OK for each merge. Squash merge only. Auto-merge is off. | Tomasz's rule. |
| D2 | Branding: light theme Stone Olive, dark theme Candle Graphite, unified arch-and-cross logo (light and dark SVG colour variants), scene 1 with the St Bogumił fresco. The direction Night Gold is dropped. Tokens: `/workspace/pacholczyk-branding/tokens.css`. | Accepted 2026-11-26. |
| D3 | Branding assets (tokens, logos, scene 1, fresco layers, Fraunces and Nunito Sans with OFL files) are committed in the scene-assets issue. Never commit the source photograph of the church. | Unknown author of the photo. |
| D4 | Map: a static image or an OpenStreetMap link. No Google Maps embed and no other cookie-setting embed. | T3 (no cookies). |
| D5 | E-mail `jpacholczyk@o2.pl` is unconfirmed. It is an open item. Do not publish it yet. | Given as unconfirmed in the grill. |
| D6 | Sandcastle orchestrator package `@ai-hero/sandcastle` 0.12.0 (not 0.14.0). Image tag: `localhost/sandcastle:pacholczyk-pogrzeby-www`. | 0.12.0 runs in the other loops on this box. |
| D7 | Node.js 26 LTS in CI and in the loop image. | Newest LTS on 2026-11-26, same as the hotel project. |
| D8 | TypeScript 6.0.3 (not 7.x) and ESLint 9.39.5 (not 10.x). | typescript-eslint 8.74.0 needs TypeScript below 6.1. eslint-plugin-jsx-a11y 6.10.2 supports ESLint up to 9. |
| D9 | This repository is public, so GitHub branch protection is available without GitHub Pro. After the CI workflow is on `main`, the owner bot turns on required checks for the 8 job ids, with force-push off and direct pushes off. | Contrast with the private hotel repo, which got HTTP 403. |
| D10 | The GitHub Pages deploy workflow is a separate issue with the label `needs-validation` and no `Sandcastle` label. CI never deploys by itself. | Preview is public. Tomasz must be able to hold it. |
| D11 | The loop is not started in this phase. The container image is not built in this phase. Free disk on the box was about 7 GB on 2026-11-26 (Europe/Warsaw). Another loop already runs on the box. | project-blueprint A4.1. Disk must be checked again before any image build. |

## 6. Test decisions

- Unit tests (Vitest): NAP constants (two offices, two phones, no unconfirmed e-mail), JSON-LD builders (`FuneralHome` for each office; `FAQPage` rules when that type appears), robots and sitemap builders (preview `noindex` / Disallow until launch), form helpers (the form does not submit and yields a call request), reduced-motion path (four still images).
- `schema` job: read every HTML file in `out/`, parse each `application/ld+json` block, validate it with typed checks (`schema-dts` types and a structural validator). Fail on invalid JSON, a missing `@context` or `@type`, a missing `FuneralHome` for either office, or a name, address or telephone that differs from `nap.ts`. `FAQPage` needs at least one `Question` with `acceptedAnswer.text` when that type appears. Do not require `FAQPage` until the FAQ issue adds it.
- `e2e-a11y` job: Playwright serves `out/` with a static server. For `/`: HTTP 200, `lang="pl"`, exactly one `h1`, a viewport meta without `user-scalable=no` or `maximum-scale=1`, axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) has 0 violations. Chromium only, viewports 390x844 and 1280x800. The sticky phone button is visible and uses `tel:` links. The form makes no network request. Requests do not go to a third-party origin (a map link may be an `href` to OpenStreetMap; it is not loaded in the test).
- `lighthouse` job: Lighthouse CI on `out/`, mobile preset, 3 runs, URL `/`, assert `largest-contentful-paint` max 2500 ms (error, `aggregationMethod: "median-run"`); accessibility score 1.0 is a warning only (axe is the hard gate). Chrome from env `CHROME_PATH` when set. Upload target `filesystem` (`.lighthouseci/`, git-ignored).
- Tests use no network. No personal data in tests. Invented test data only.

## 7. Limits and risks

- Disk on the box: about 7.3 GB free at 16:34 Europe/Warsaw on 2026-11-26 (95 % used). Do not build the loop image until there is a safe margin. Do not run `podman` reset or repair, and do not remove images, while another loop runs.
- A hotel-site loop is already on the box (pid file `/tmp/gosciniec-www-loop.pid`). Only one image build at a time.
- The loop agent has an idle timeout. Issues contain exact tool versions, so the agent does not search the web.
- Kody: about 2500 fetches per week. Cron expressions are in UTC.
- Grok Bot usage follows the owner's plan limits.
- GitHub Actions minutes for a public repository are free. Still keep jobs short (Lighthouse and Playwright use the most time).
- GitHub Pages makes the preview public. `noindex` must be in place before the first deploy.
- The source church photograph has an unknown author. It must never enter this repository.
- Personal data of families must never appear in the repository or in tests.
- Fine-grained PAT (PS3) is not in place yet. The loop cannot start without it.

## 8. Open items

1. Confirm or reject the e-mail address `jpacholczyk@o2.pl` (D5). Until then, do not publish it.
2. Fine-grained PAT for this repository (PS3). The owner bot will ask Tomasz later with a masked field. Do not start the loop before the PAT is in `.sandcastle/.env`.
3. Production domain and DNS. None until Tomasz gives the words to proceed.
4. Scene 2, 3 and 4 painted assets (light and dark). Specs are in the scene-assets issue. The owner bot may generate them outside the loop. The loop must not invent stand-in photographs.
5. `LOOP_WEBHOOK_URL` for the later "pacholczyk-www: loop events" routine. The sender key already exists on the box. The URL comes when the routine is created (not in this phase).
6. Legal pages (terms, privacy) if they are needed at launch. Not in the current issue list.
7. Google Business Profile entries for the two offices. Out of scope for the site build.

## 9. Glossary

See `GLOSSARY.md`.
