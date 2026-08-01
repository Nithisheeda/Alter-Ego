# Alter-Ego — Engine 2: The Speech & Mindset Coach

A dark-mode React + Tailwind app that pairs vocal cadence tracking with
identity-level coaching. The AI speaks as your Future-Self — a grounded,
unshakeable version of you — reviewing speech drills and situational prep.

## Modules

- **Future-Self Identity Mapping** — define your persona (name, demeanor,
  standards, mantra), persisted to `localStorage`.
- **Structured Speech Drill** — read a passage aloud with a live recorder
  (Web Speech API + Web Audio analyser) tracking WPM, pause frequency, and
  duration, with a live audio-wave visualizer.
- **Situational Mindset Prep** — describe an upcoming high-stakes moment by
  text or voice for a Future-Self reframe.
- **Future-Self Feedback** — Reality Check / Tactical Adjustment / Mindset
  Reframe, generated live via the Anthropic API or a structured mock
  fallback when no key is configured.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_ANTHROPIC_API_KEY` to enable live
Future-Self AI feedback. Without a key, the app uses structured mock
diagnostics — the status badge in the header shows which mode is active.

## Mobile & PWA

The app is installable on iOS and Android home screens (`public/manifest.json`,
touch icons, `display: standalone`) and registers a lightweight service
worker (`public/sw.js`, production builds only) that caches core static
assets while always hitting the network for Anthropic API calls. Layouts
stack to a single column through the `md` breakpoint, form inputs use a
16px minimum font size to prevent iOS Safari auto-zoom, and interactive
controls use 44px-minimum tap targets.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run Oxlint
