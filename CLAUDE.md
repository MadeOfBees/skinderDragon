# skinderdragon

Minecraft skin viewer — React + TypeScript + Vite, deployed to GitHub Pages.
skinview3d + three.js for 3D rendering, gifenc for GIF export.

## Commands

```bash
npm run verify   # fast gate: tsc --noEmit + vitest (~1s, no browser) — run this after every change
npm run smoke    # on-demand browser smoke: builds, serves, runs Playwright, tears down (~10s local GPU / ~75s CI)
npm run dev      # dev server → http://localhost:5173/
npm run build    # production build (tsc + vite)
```

`verify` is the only command I should run routinely. `smoke` only when touching WebGL / GIF / panorama code — once, synchronously. CI runs `smoke` automatically on every push via `.github/workflows/ci.yml`.

## Architecture: non-obvious decisions

**Panorama** — six inward-facing planes (not a BoxGeometry skybox). Pivot Y-rotations are NEGATED vs Minecraft's matrix code because three.js and MC have opposite camera handedness. The ring direction is: face N's RIGHT edge → face N+1's LEFT (turning right). Verified by pixel-matching face edges (MSE ~3–270 correct, ~6000+ wrong). Faces live in `public/panorama/<channel>/` (gitignored, not bundled); `npm run assets:refresh` downloads them and Steve's default favicon (`public/favicon.png`) from Mojang's CDN. `npm run dev` (via `assets:ensure`), `npm run smoke`, and the Pages deploy (`.github/workflows/deploy.yml`) all fetch them automatically — but a bare `npm run build` does NOT, so deploy runs `assets:refresh` as its own step. Without the files `vite build` still succeeds and silently ships a panorama/favicon-less site, so that step is load-bearing. Run `npm run assets:refresh` once after cloning.

**Animation factory** — `createModeAnimation()` in `exportGif.ts` is the single source of truth for mode→animation class mapping; both `usePreview` and `generateGif` call it. `headBobbing` is the only legitimate difference (preview: `true`, exporter: `false` to avoid breaking the short loop).

**GIF exporter** — `sneak` and `fly` are held poses (not cycles); `orbit` is an independent toggle that spins `playerWrapper`. A held pose + no orbit → single-frame GIF. The `?gifSize=256&gifFrames=8` URL knob (used by the smoke test) renders tiny GIFs for speed; production defaults (512/30) apply when absent.

**Settings** — stored in `localStorage` via `src/lib/settings.ts`. `panoramaSource` is the only persisted key so far.

**Smoke renderer** — `SMOKE_RENDERER=gpu|cpu|auto` (default `auto`). Locally picks the real GPU (Metal on M3, ~10s); CI sets `SMOKE_RENDERER=cpu` for SwiftShader (~75s, deterministic, no GPU needed).

## Workflow rules

- After changes: run `npm run verify` once. Don't re-run it, don't poll it.
- Don't run `npm run test:e2e` directly — it's gone; use `npm run smoke` instead.
- If a tool/dep is missing, ask the user to set it up — don't probe the filesystem.
- No trailing summaries after completing tasks — the user can read the diff.
- Use `seg()` from `src/lib/ui.ts` for active/stone button classes — it's the shared helper.
