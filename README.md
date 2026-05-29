# skinderdragon

Turn a Minecraft username into a looping skin GIF. Type a name, and skinderdragon
renders that player's skin **and cape** on a 3D model, then exports a seamless
animated GIF — either **running in place** or **frozen mid-stride while the camera
orbits**.

It runs entirely in the browser. No backend, no uploads — the skin/cape PNGs come
straight from Mojang's official texture CDN and everything is rendered and encoded
client-side.

---

## Features

- 🔎 **Username → skin** with automatic slim ("Alex") / classic ("Steve") detection.
- 🧥 **Capes** are fetched and rendered automatically when a player's wearing one.
- 🏃 **Run mode** — a seamless walk/run cycle.
- 🔄 **Orbit mode** — the model freezes mid-stride while the camera spins a full 360°.
- 🎨 **Background** — solid color (with a picker) or transparent.
- 🖱️ **Live preview** you can drag to rotate before exporting.
- 💾 **One-click download** of a looping 512×512 GIF.

## How it works

```
username
   │  playerdb.co  (CORS-enabled wrapper around Mojang's own API)
   ▼
UUID + model + official textures.minecraft.net URLs
   │  fetch as Blob → object URL  (keeps the WebGL canvas untainted)
   ▼
skinview3d (three.js)  →  render frames  →  gifenc  →  looping GIF
```

A few deliberate choices worth calling out:

- **Why playerdb (and not Mojang directly)?** Mojang's lookup endpoints
  (`api.mojang.com`, `sessionserver.mojang.com`) don't send CORS headers, so a static
  browser app can't read them. [playerdb.co](https://playerdb.co) is a CORS-enabled
  wrapper that returns Mojang's data unmodified — including the canonical
  `textures.minecraft.net` URLs. The actual skin/cape **images are downloaded from
  Mojang's official CDN**, which *is* CORS-enabled. The data source lives behind a
  single function (`resolveTextures` in [`src/lib/providers.ts`](src/lib/providers.ts)),
  so swapping it for a generic proxy or a self-hosted worker is a one-file change.
- **Untainted canvas.** Textures are fetched as blobs and loaded via same-origin
  object URLs. This guarantees the WebGL canvas is never "tainted", which is what lets
  us read pixels back (`getImageData`) to encode the GIF.
- **Seamless loops by construction.** Frames are stepped deterministically rather than
  captured in real time. The walk animation drives limbs with `sin(progress · 8)`, so
  one full cycle spans a `progress` interval of `π/4` — we loop over exactly that.
  Head-bobbing (a much longer period) is disabled for exports so the short loop stays
  seamless. Orbit mode freezes the pose once and rotates the model `0 → 2π`.
- **GIF transparency caveat.** GIF only supports 1-bit alpha, so transparent exports
  have slightly hard edges. Solid backgrounds are crisp and are the default.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [skinview3d](https://github.com/bs-community/skinview3d) (three.js) for rendering
- [gifenc](https://github.com/mattdesl/gifenc) for in-browser GIF encoding
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) +
  [Playwright](https://playwright.dev/) for tests

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
```

### Build & preview

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

## Testing

```bash
npm test                 # unit + component tests (Vitest)
npm run test:watch       # watch mode
npm run test:coverage    # with coverage
npm run test:e2e         # headless end-to-end smoke test (Playwright)
```

- **Unit / component** tests cover the data layer (username validation, playerdb
  parsing, cape/model detection, error mapping), the GIF math + encoder, and the React
  UI (loading a skin, cape badge, errors, mode/background selection, download naming).
- The **e2e smoke test** ([`scripts/smoke.mjs`](scripts/smoke.mjs)) drives the real app
  in headless Chromium (WebGL via SwiftShader): it loads skins with and without capes,
  generates GIFs in every mode/background combination, and validates the emitted bytes
  are genuine looping GIFs (with the transparency flag set when requested). It needs the
  dev server running:

  ```bash
  npm run dev          # in one terminal
  npm run test:e2e     # in another
  ```

  First run only: `npx playwright install chromium`.

## Project structure

```
src/
  App.tsx              UI, live preview, controls, export orchestration
  lib/
    providers.ts       username → official Mojang texture URLs (the data-source seam)
    textures.ts        http→https + fetch-as-object-URL helpers
    profile.ts         ties the two together into a renderable profile
    exportGif.ts       frame stepping + gifenc encoding (+ pure, tested helpers)
  index.css            Tailwind entry + theme tokens
scripts/smoke.mjs      Playwright end-to-end smoke test
```

## Deployment (GitHub Pages)

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
publishes to GitHub Pages on every push to `main`. It derives the Vite `base` path from
the repository name automatically, so no hardcoding is needed.

To go live:

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the site deploys to `https://<user>.github.io/<repo>/`.

For local production builds under a custom path, override the base:

```bash
VITE_BASE=/my-repo/ npm run build
```

## Roadmap / ideas

- [ ] More animations: idle, wave, crouch, fly, swim, and a true run-vs-walk toggle.
- [ ] Elytra rendering (skinview3d supports it alongside capes).
- [ ] Higher-quality output: WebM / APNG / MP4 export to escape GIF's 256-color, 1-bit-alpha limits.
- [ ] PNG sprite-sheet export for game/UI use.
- [ ] UI controls for size, FPS, duration, zoom, and lighting.
- [ ] Background presets and panorama scenes (sky, nether, the void).
- [ ] Shareable deep links (`?user=…&mode=…&bg=…`) and a copy-link button.
- [ ] Drag-and-drop / file upload for custom skins (no account needed).
- [ ] Second-layer (hat/jacket overlay) and ear toggles; name tag rendering.
- [ ] Optional self-hosted Cloudflare Worker data source for full Mojang officialness.
- [ ] Result caching + recently-viewed players.
- [ ] PWA / offline support and a light theme.

## Data & attribution

Player lookups are powered by [playerdb.co](https://playerdb.co); skin and cape textures
are served from Mojang's official `textures.minecraft.net` CDN. skinderdragon is a
fan-made tool and is **not affiliated with or endorsed by Mojang or Microsoft**.
"Minecraft" is a trademark of Mojang Synergies AB.
