# skinderdragon

Minecraft skin viewer — React + TypeScript + Vite, deployed to GitHub Pages.
skinview3d + three.js for 3D rendering, gifenc for GIF export.

## Commands

```bash
npm run verify   # fast gate: tsc --noEmit + vitest (~1s, no browser) — run this after every change
npm run smoke    # on-demand browser smoke: builds, serves, runs Playwright, tears down (~10s local / ~75s CI)
npm run dev      # dev server → http://localhost:5173/
npm run build    # strict asset ensure + production build (tsc + vite)
```

`verify` is the only command I should run routinely. `smoke` only when touching WebGL / GIF / panorama code — once, synchronously. CI runs `smoke` automatically on every push.

## Architecture: non-obvious decisions

**Panorama** — six inward-facing planes (not a BoxGeometry skybox). Pivot Y-rotations are NEGATED vs Minecraft's matrix code because three.js and MC have opposite camera handedness. Verified by pixel-matching face edges (MSE ~3–270 correct, ~6000+ wrong). Faces live in `public/panorama/<channel>/` (gitignored); `npm run assets:refresh` downloads them and Steve's favicon from Mojang's CDN. `npm run dev`, `npm run smoke`, the Pages deploy, and `npm run build` all fetch missing assets automatically. Build uses strict asset ensure, so missing assets fail the build instead of shipping without panorama/favicon. Run `npm run assets:refresh` once after cloning.

**One render path — the GIF IS the preview.** One viewer (in `usePreview`); the GIF is captured straight from it. `applyLoopFrame(targets, modeAnim, t, opts)` in `exportGif.ts` is the single source of truth for a frame at phase `t` ∈ [0,1). The live preview drives it via `FunctionAnimation`; `captureViewerGif` steps it by hand at `t = i/frames`, borrowing and restoring the viewer's size/background/render-loop. `createModeAnimation()` returns a `ModeAnimation` (`cycle` fn for `run`, `held` pose for `sneak`/`fly`); `settleHeldPose()` must be called AFTER assigning the animation to the viewer (assignment resets joints). Do NOT add a second offscreen viewer for export.

**Orbit / held poses** — `sneak` and `fly` are held poses; `orbit` spins `playerWrapper` independently. Held pose + no orbit → single-frame GIF. `?gifSize=256&gifFrames=2` URL knob renders tiny GIFs for the smoke test; production defaults (`DEFAULT_GIF_SIZE=512`, `DEFAULT_FRAMES=30`) apply when absent.

**Nametag font** — `captureGif` awaits `fontReadyRef.current` (a ref set to `tag.painted` when the nametag is on, `Promise.resolve()` otherwise) before the first frame. This guarantees Monocraft is loaded before capture starts; `repaintAfterLoaded: true` handles the live preview repaint separately.

**Settings** — persisted to `localStorage` via `src/lib/settings.ts`. Current keys are `panoramaSource` and `edition`.

**Smoke renderer** — `SMOKE_RENDERER=gpu|cpu|auto` (default `auto`). CI sets `cpu` for SwiftShader (~75s, deterministic).

## Workflow rules

- After changes: run `npm run verify` once. Don't re-run it, don't poll it.
- If a tool/dep is missing, ask the user to set it up — don't probe the filesystem.
- No trailing summaries after completing tasks — the user can read the diff.
- Use `seg()` from `src/lib/ui.ts` for active/stone button classes.
