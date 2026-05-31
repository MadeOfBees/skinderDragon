import { GIFEncoder, quantize, applyPalette, type PixelFormat } from "gifenc";
import type { PlayerObject, SkinViewer } from "skinview3d";
import type { Group } from "three";
import { loadSkinview3d } from "./skinview";

export type AnimationMode = "run" | "sneak" | "fly";

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string };

export interface CaptureOptions {
  /** Spin the player a full turn across the loop. */
  orbit: boolean;
  /** Render the player flipped (Dinnerbone/Grumm easter egg). */
  upsideDown: boolean;
  background: Background;
  /** Output square size in pixels. @default 512 */
  size?: number;
  /** Number of frames in the loop. @default 30 */
  frames?: number;
  /** Frames per second. @default 12 */
  fps?: number;
  onProgress?: (fraction: number) => void;
}

export const DEFAULT_GIF_SIZE = 512;
export const DEFAULT_FRAMES = 30;
export const DEFAULT_FPS = 12;
/** Seconds per loop at the default rate — used by the live preview clock. */
export const LOOP_SECONDS = DEFAULT_FRAMES / DEFAULT_FPS;

// RunningAnimation drives limbs with cos(progress * 15); one full cycle = 2π/15.
const RUN_CYCLE = (2 * Math.PI) / 15;
// CrouchAnimation.showProgress reaches full crouch at progress = 0.125.
const CROUCH_POSE = 0.125;
// FlyingAnimation fully extends by ~progress 0.5; overshoot slightly to be safe.
const FLY_POSE = 1.5;

/** Player y-rotation (rad) at loop phase t — one full orbit over t ∈ [0, 1). */
export function orbitRotationForPhase(t: number): number {
  return t * Math.PI * 2;
}

export function frameFormat(background: Background): PixelFormat {
  return background.kind === "transparent" ? "rgba4444" : "rgb565";
}

export function pickTransparentIndex(palette: number[][]): number {
  return palette.findIndex((c) => c.length >= 4 && c[3] === 0);
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** Encodes pre-captured RGBA frames into a looping GIF. DOM-free and unit-testable. */
export async function encodeFramesToGif(
  frames: Array<Uint8ClampedArray | Uint8Array>,
  opts: {
    size: number;
    fps: number;
    background: Background;
    onProgress?: (fraction: number) => void;
  }
): Promise<Uint8Array> {
  const { size, fps, background, onProgress } = opts;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  const transparent = background.kind === "transparent";
  const format = frameFormat(background);

  for (let i = 0; i < frames.length; i++) {
    const data = frames[i];
    const palette = quantize(data, 256, { format, oneBitAlpha: transparent });
    const index = applyPalette(data, palette, format);
    const transparentIndex = transparent ? pickTransparentIndex(palette) : -1;

    gif.writeFrame(index, size, size, {
      palette,
      delay,
      repeat: 0,
      transparent: transparent && transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
    });

    onProgress?.((i + 1) / frames.length);
    if (i % 4 === 3) await yieldToUi();
  }

  gif.finish();
  return gif.bytes();
}

type Skinview3d = Awaited<ReturnType<typeof loadSkinview3d>>;

/** The subset of the viewer that one loop frame mutates. */
export interface LoopTargets {
  playerObject: PlayerObject;
  playerWrapper: Group;
}

/** Poses the model for one loop frame at phase t ∈ [0, 1). */
export type CycleFn = (targets: LoopTargets, t: number) => void;

/**
 * A resolved mode animation. Cyclic modes have a CycleFn driven per frame;
 * held poses store the animation and progress value to freeze at.
 * Exactly one of `cycle` / `held` is non-null.
 */
export interface ModeAnimation {
  cycle: CycleFn | null;
  held: { anim: InstanceType<Skinview3d["PlayerAnimation"]>; pose: number } | null;
}

/** True when the mode+orbit combination produces a multi-frame animation. */
export function isAnimated(modeAnim: ModeAnimation, orbit: boolean): boolean {
  return modeAnim.cycle !== null || orbit;
}

function driveCycle(
  anim: InstanceType<Skinview3d["PlayerAnimation"]>,
  cycleProgress: number
): CycleFn {
  return (targets, t) => {
    anim.progress = t * cycleProgress;
    anim.update(targets.playerObject, 0);
  };
}

/** Maps a mode to its animation. Single source of truth shared by preview and export. */
export function createModeAnimation(sv: Skinview3d, mode: AnimationMode): ModeAnimation {
  switch (mode) {
    case "sneak": {
      const anim = new sv.CrouchAnimation();
      anim.showProgress = true; // smooth depth, not the stepwise floor
      return { cycle: null, held: { anim, pose: CROUCH_POSE } };
    }
    case "fly":
      return { cycle: null, held: { anim: new sv.FlyingAnimation(), pose: FLY_POSE } };
    case "run":
    default:
      return { cycle: driveCycle(new sv.RunningAnimation(), RUN_CYCLE), held: null };
  }
}

/**
 * Settles a held pose once. Must be called after assigning the animation to the
 * viewer — assignment resets joints. No-op for cyclic modes.
 */
export function settleHeldPose(modeAnim: ModeAnimation, playerObject: PlayerObject): void {
  if (modeAnim.held) {
    modeAnim.held.anim.progress = modeAnim.held.pose;
    modeAnim.held.anim.update(playerObject, 0);
  }
}

/** Positions the player for one loop frame at phase t ∈ [0, 1). */
export function applyLoopFrame(
  targets: LoopTargets,
  modeAnim: ModeAnimation,
  t: number,
  opts: { orbit: boolean; upsideDown: boolean }
): void {
  modeAnim.cycle?.(targets, t);
  if (opts.orbit) targets.playerWrapper.rotation.y = orbitRotationForPhase(t);
  if (opts.upsideDown) targets.playerObject.rotation.z = Math.PI;
}

/**
 * Captures a seamless looping GIF from the live preview viewer.
 * Only the drawing buffer is resized (`setSize(..., false)` skips canvas CSS)
 * so the on-screen layout never shifts. Everything is restored in the finally block.
 */
export async function captureViewerGif(
  viewer: SkinViewer,
  modeAnim: ModeAnimation,
  opts: CaptureOptions
): Promise<Blob> {
  const {
    orbit,
    upsideDown,
    background,
    size = DEFAULT_GIF_SIZE,
    frames = DEFAULT_FRAMES,
    fps = DEFAULT_FPS,
    onProgress,
  } = opts;

  const renderer = viewer.renderer;
  const prev = {
    width: viewer.width,
    height: viewer.height,
    pixelRatio: renderer.getPixelRatio(),
    background: viewer.background,
    renderPaused: viewer.renderPaused,
  };

  const capture = document.createElement("canvas");
  capture.width = size;
  capture.height = size;
  const ctx = capture.getContext("2d", { willReadFrequently: true })!;

  // A held pose with no orbit is a still image — one frame is enough.
  const frameCount = isAnimated(modeAnim, orbit) ? frames : 1;

  try {
    // Resize the viewer's drawing buffer to export dimensions; CSS layout unchanged.
    viewer.renderPaused = true; // we drive every frame by hand
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false); // false = don't touch canvas CSS
    viewer.composer.setPixelRatio(1);
    viewer.composer.setSize(size, size);
    viewer.fxaaPass.material.uniforms["resolution"].value.set(1 / size, 1 / size);
    viewer.background = background.kind === "color" ? background.color : null;

    const rgbaFrames: Uint8ClampedArray[] = [];
    for (let i = 0; i < frameCount; i++) {
      applyLoopFrame(viewer, modeAnim, i / frameCount, { orbit, upsideDown });
      viewer.render();

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(viewer.canvas, 0, 0, size, size);
      rgbaFrames.push(ctx.getImageData(0, 0, size, size).data);

      onProgress?.((i + 1) / frameCount / 2); // first half of total progress
      await yieldToUi();
    }

    const bytes = await encodeFramesToGif(rgbaFrames, {
      size,
      fps,
      background,
      onProgress: (f) => onProgress?.(0.5 + f / 2),
    });
    return new Blob([bytes as BlobPart], { type: "image/gif" }); // gifenc returns a plain buffer; cast is safe
  } finally {
    // Restore pixel ratio before setSize so buffers rebuild at the right scale.
    viewer.background = prev.background;
    renderer.setPixelRatio(prev.pixelRatio);
    viewer.setSize(prev.width, prev.height);
    viewer.renderPaused = prev.renderPaused;
  }
}
