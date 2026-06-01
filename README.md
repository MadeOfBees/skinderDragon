<div align="center">

# skinderdragon

[![CI](https://img.shields.io/github/actions/workflow/status/MadeOfBees/skinderDragon/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/MadeOfBees/skinderDragon/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-brightgreen?style=flat-square)](https://madeofbees.github.io/skinderDragon/)
[![License](https://img.shields.io/github/license/MadeOfBees/skinderDragon?style=flat-square)](LICENSE)

**Minecraft usernames in, looping 3D skin GIFs out — rendered and encoded 100% in your browser.**

[**▶ Open the live demo**](https://madeofbees.github.io/skinderDragon/)

</div>

Turn a Minecraft player into a looping skin GIF. Type a username (Java) or gamertag
(Bedrock) and skinderdragon renders that player's skin **and cape** on a draggable 3D
model, then exports a seamless animated GIF — **running**, **crouching**, or **flying**,
optionally **orbiting** a full 360° while a Minecraft title-screen panorama drifts behind it.

It runs entirely in the browser. No backend, no uploads — the skin/cape PNGs come
straight from Mojang's official texture CDN and everything is rendered and encoded
client-side.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Assets](#assets)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment-github-pages)
- [Contributing](#contributing)
- [Data & attribution](#data--attribution)
- [License](#license)

## Features

- 🔎 **Username → skin** with automatic slim ("Alex") / classic ("Steve") detection.
- 🎮 **Java *and* Bedrock** — switch editions in Settings. Java lookups go through
  playerdb; Bedrock gamertags resolve through the GeyserMC Global API.
- 🧥 **Capes** are fetched and rendered automatically, with a live cape-front badge.
- 🏃 **Three animations** — a seamless run cycle, a held crouch, and a held flying pose.
- 🔄 **Orbit** — an independent toggle that spins the model a full turn, combinable with
  any mode. (A held pose with orbit off is exported as a single still frame.)
- 🏷️ **Floating nametag** in Minecraft's pixel font, rendered into the GIF.
- 🎨 **Background** — solid color (with a picker) or transparent.
- 🌄 **Animated panorama** — the real Minecraft title-screen background (release or
  snapshot channel), drifting behind the UI and rendering a single static frame for
  reduced-motion users.
- 🖱️ **Live preview you can drag** — and the GIF is captured from *that exact viewer*,
  so what you see is what you download.
- 💾 **One-click downloads** — a looping 512×512 GIF, plus the raw skin PNG and a
  rendered head PNG.
- ✨ **Minecraft flourishes** — random splash text, an "Advancement Made!" toast, the
  searched player's head as the tab favicon (remembered across visits), and the
  Dinnerbone/Grumm upside-down easter egg.

## How it works

```text
username / gamertag
   │  Java → playerdb.co     Bedrock → api.geysermc.org (gamertag → XUID → skin)
   ▼
playerId + model + official textures.minecraft.net URLs
   │  fetch as Blob → object URL  (keeps the WebGL canvas untainted)
   ▼
skinview3d (three.js) live preview  ──step frames──▶  gifenc  ──▶  looping GIF
```

A few deliberate choices worth calling out:

- **Why playerdb / GeyserMC (and not Mojang directly)?** Mojang's lookup endpoints
  (`api.mojang.com`, `sessionserver.mojang.com`) don't send CORS headers, so a static
  browser app can't read them. For Java, [playerdb.co](https://playerdb.co) is a
  CORS-enabled wrapper that returns Mojang's data unmodified — including the canonical
  `textures.minecraft.net` URLs. For Bedrock (which uses Xbox Live accounts), the
  [GeyserMC Global API](https://api.geysermc.org) converts a gamertag → XUID → skin;
  note it only has skins for players who have joined a Floodgate/GeyserMC server. Both
  paths live behind a single function (`resolveTextures` in
  [`src/lib/providers.ts`](src/lib/providers.ts)), so swapping in a generic proxy or a
  self-hosted worker is a one-file change. The actual skin/cape **images always come
  from Mojang's official CDN**, which *is* CORS-enabled.

- **Untainted canvas.** Textures are fetched as blobs and loaded via same-origin object
  URLs. This guarantees the WebGL canvas is never "tainted", which is what lets us read
  pixels back (`getImageData`) to encode the GIF.

- **One render path — the GIF *is* the preview.** There's a single skinview3d viewer
  (in [`src/hooks/usePreview.ts`](src/hooks/usePreview.ts)); the GIF is captured straight
  from it by borrowing and restoring its size/background/render-loop. `applyLoopFrame()`
  in [`src/lib/exportGif.ts`](src/lib/exportGif.ts) is the single source of truth for a
  frame at phase `t` ∈ [0, 1): the live preview drives it via a `FunctionAnimation`; the
  exporter steps it by hand at `t = i/frames`. No second offscreen renderer to drift out
  of sync — what you drag is what you download.

- **Seamless loops by construction.** Frames are stepped deterministically rather than
  captured in real time. The run animation drives limbs with `cos(progress · 15)`, so one
  full cycle spans a `progress` interval of `2π/15` — we loop over exactly that. Crouch
  and fly are *held* poses settled once and frozen, so with orbit off they export as a
  single frame; orbit mode rotates the model `0 → 2π` across the loop.

- **The panorama is six planes, not a skybox.** Minecraft's title background is rendered
  as six inward-facing planes (one per cube face) rather than a `BoxGeometry`. The pivot
  Y-rotations are *negated* versus Minecraft's own matrix code because three.js and MC
  have opposite camera handedness; the exact signs were nailed down by pixel-matching
  adjacent face edges (edge MSE ~3–270 when correct, ~6000+ when wrong). Faces are
  downloaded from Mojang's CDN, not committed — see [Assets](#assets) below.

- **GIF transparency caveat.** GIF only supports 1-bit alpha, so transparent exports have
  slightly hard edges. Solid backgrounds are crisp and are the default.

## Tech stack

- [Vite 6](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript
- [skinview3d](https://github.com/bs-community/skinview3d) (three.js) for 3D rendering
- [gifenc](https://github.com/mattdesl/gifenc) for in-browser GIF encoding
- [Tailwind CSS v4](https://tailwindcss.com/) for the custom "Ore UI" theme
- [sharp](https://sharp.pixelplumbing.com/) for the asset-fetch pipeline (Node-side only)
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) for
  unit/component tests, and [Playwright](https://playwright.dev/) for the browser smoke

## Requirements

- **To use it:** any modern browser with **WebGL** — that's what renders the 3D skin.
  Without WebGL the skin viewer won't load; the panorama also needs it and quietly falls
  back to a plain background when it's absent.
- **To develop it:** **Node 20+** (declared in `package.json` under `engines`).

## Getting started

```bash
npm install
npm run assets:refresh   # one-time: download panorama faces + default favicon from Mojang
npm run dev              # start the dev server at http://localhost:5173
```

`npm run dev` also runs `assets:ensure` for you, so a fresh clone will self-heal the
assets on first launch — but running `assets:refresh` once explicitly is the reliable way
to get them in place. See [Assets](#assets) below for what these are and why they aren't committed.

## Commands

```bash
npm run dev          # dev server with HMR → http://localhost:5173
npm run build        # ensure assets + type-check + production build to dist/
npm run preview      # serve the production build locally

npm run verify       # fast gate: tsc --noEmit + vitest (no browser) — run after every change
npm run smoke        # turnkey browser smoke: build → serve → Playwright → tear down
npm test             # unit + component tests (Vitest)
npm run test:watch   # Vitest in watch mode
npm run test:coverage

npm run assets:refresh   # (re)download panorama faces + favicon from Mojang's CDN
npm run assets:ensure    # download only what's missing (used by dev/smoke/deploy)
npm run assets:build     # strict asset ensure used by production builds
```

`verify` is the routine gate; `smoke` is on-demand for WebGL / GIF / panorama changes.

## Assets

Two sets of static files are fetched from Mojang's CDN at build/dev time and **kept out of
git** (`public/panorama/`, `public/favicon.png` are gitignored):

- **Panorama faces** — the six PNGs of the title-screen background, downscaled to WebP.
  Two channels are kept side by side: `release/` (the app default) and `snapshot/`
  (the opt-in toggle in Settings).
- **Default favicon** — MHF_Steve's face, used before you've searched anyone.

[`scripts/refresh-assets.mjs`](scripts/refresh-assets.mjs) walks Mojang's version
manifest → version JSON → asset index → object hashes to find the current panorama, and
reuses the playerdb pipeline for Steve's face. `npm run dev`, `npm run smoke`, and the
Pages deploy all fetch these automatically. `npm run build` runs a strict asset ensure
first, so missing assets fail the build instead of shipping without a panorama or default
favicon.

## Project structure

```text
src/
  App.tsx                top-level UI, state, and export orchestration
  hooks/
    usePreview.ts        the live skinview3d viewer + captureGif (the single render path)
  components/            Ore-UI controls: SearchBar, Slider, Switch, Multibutton,
                         Panorama, Settings, GifModal, Toast, CloseIcon
  lib/
    providers.ts         username/gamertag → official Mojang texture URLs (data-source seam)
    profile.ts           resolve + fetch-as-object-URL → a renderable profile
    textures.ts          http→https + fetch-as-object-URL helpers
    exportGif.ts         frame stepping + gifenc encoding (single source of truth)
    skinview.ts          lazy, shared skinview3d/three import
    head.ts              player-head + cape-front canvas renders
    favicon.ts           last-search persistence + tab favicon
    settings.ts          localStorage settings (edition, panorama channel)
    ui.ts                seg() active/stone button helper
  data/splashes.ts       random Minecraft-style splash lines
  index.css              Tailwind v4 entry + Ore-UI theme tokens
scripts/
  refresh-assets.mjs     download panorama faces + favicon from Mojang's CDN
  smoke-local.mjs        turnkey: build → serve → smoke → tear down
  smoke.mjs              Playwright browser smoke (real lookup → WebGL → GIF validation)
  analyze-gif.mjs        GIF-byte validator used by the smoke test
```

## Testing

- **Unit / component** (`npm run verify` or `npm test`) cover the data layer (the Java
  lookup path, username validation, texture-property decoding, cape/model detection, error
  mapping), the GIF math + encoder, and the React UI. They run in happy-dom with no
  browser, in about a second. The Bedrock/GeyserMC lookup path is implemented but has no
  automated coverage yet — it's verified by hand.

- **Browser smoke** ([`scripts/smoke.mjs`](scripts/smoke.mjs)) drives the real app in
  headless Chromium and validates the emitted bytes are genuine looping GIFs (with the
  transparency flag set when requested). It exercises the one path jsdom can't: live skin
  lookups + WebGL render + gifenc encode, across modes/backgrounds and with/without a
  cape. `npm run smoke` is turnkey — it builds, serves the build, runs the test, and tears
  the server down:

  ```bash
  npm run smoke
  ```

  It renders tiny GIFs via the `?gifSize=256&gifFrames=2` URL knobs to stay fast, and
  picks a renderer with `SMOKE_RENDERER=gpu|cpu|auto` (default `auto`; CI forces `cpu`
  for deterministic SwiftShader software rendering). First run only:
  `npx playwright install chromium`.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `verify` + `build` and
the browser smoke on every push and PR.

## Deployment (GitHub Pages)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes to
GitHub Pages on every push to `main`. It runs the tests, fetches the Mojang assets (so a
CDN failure fails the deploy loudly rather than shipping a broken site), and derives the
Vite `base` path from the repository name automatically — no hardcoding.

To go live:

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the site deploys to `https://<user>.github.io/<repo>/`.

For a local production build under a custom path, override the base:

```bash
VITE_BASE=/my-repo/ npm run build
```

## Contributing

`npm run verify` (typecheck + unit tests) is the fast gate — run it before every push;
it's exactly what CI runs first. When you touch WebGL / GIF / panorama code, also run
`npm run smoke` once locally (CI runs it on every push, but catching a break before you
push is quicker). The architecture notes in [CLAUDE.md](CLAUDE.md) go deeper on the
non-obvious decisions.

## Data & attribution

Java lookups are powered by [playerdb.co](https://playerdb.co); Bedrock lookups by the
[GeyserMC Global API](https://api.geysermc.org); skin and cape textures are served from
Mojang's official `textures.minecraft.net` CDN. The nametag uses the
[Monocraft](https://github.com/IdreesInc/Monocraft) font. skinderdragon is a fan-made tool
and is **not affiliated with or endorsed by Mojang or Microsoft**. "Minecraft" is a
trademark of Mojang Synergies AB.

## License

[MIT](LICENSE).
