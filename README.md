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
  Reframe, generated live via Claude or a structured mock fallback when no
  key is reachable.

## Setup

```bash
npm install
npm run dev
```

## AI key resolution

The app never calls Anthropic with a key bundled into client code. Instead,
each request resolves in this order:

1. **A personal key saved in Settings** (`localStorage`, entered in the app's
   Settings modal) — called directly from the browser. Useful for local
   development or a user who wants to bring their own key.
2. **The `/api/claude` Vercel Edge Function** (`api/claude.ts`) — a same-origin
   proxy that reads `ANTHROPIC_API_KEY` from the server environment, so the
   real key never reaches the client. Restricted to `localhost`, `*.vercel.app`,
   and the deploy's own origin.
3. **Structured mock diagnostics** — used if neither of the above succeeds
   (offline, no key configured, proxy error).

Set `ANTHROPIC_API_KEY` (server-side only — do not prefix with `VITE_`) in
your Vercel project's Environment Variables to enable step 2 for every
visitor. See `.env.example`. The header's status badge reflects whether a
personal key is active; each feedback/pushback card also shows "Live AI" or
"Mock" for what actually happened on that call.

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
