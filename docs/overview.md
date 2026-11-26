# Overview

This repository will hold a one-page static site. The scaffold issue adds the folders below.

```
src/app/              one page (App Router, static export) and the root layout
src/components/       sticky phone button, theme toggle, scroll story, sections
src/lib/nap.ts        name, two offices, two phones (single source)
src/lib/schema/       JSON-LD builders (FuneralHome for each office, FAQPage)
src/styles/           design tokens (Stone Olive / Candle Graphite)
public/img/           painted scene layers, fresco layers, logo SVG
public/fonts/         Fraunces and Nunito Sans (OFL), latin-ext
scripts/              postbuild, check-schema (+ tests), precommit, start-loop
e2e/                  Playwright + axe tests
.github/workflows/    ci.yml with the 8 required jobs
.sandcastle/          loop orchestrator and agent prompts (host only)
docs/                 PRD and this overview
```

Build: `npm run build` writes `out/` (HTML, CSS, JS, images, `robots.txt`, `sitemap.xml`).
Preview (later, issue with label `needs-validation`): GitHub Pages, `noindex` until launch.
There is no production domain yet. Do not change DNS without Tomasz's words.
