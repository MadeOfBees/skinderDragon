import { GIFEncoder, quantize, applyPalette, type PixelFormat } from "gifenc";
import type { PlayerObject, SkinViewer } from "skinview3d";
import type { Group } from "three";
import { loadSkinview3d } from "./skinview";

export type Pose = "run" | "walk" | "sneak" | "fly" | "stand";

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
  signal?: AbortSignal;
}

export const DEFAULT_GIF_SIZE = 512;
export const DEFAULT_FRAMES = 30;
export const DEFAULT_FPS = 12;
/** Seconds per loop at the default rate — used by the live preview clock. */
export const LOOP_SECONDS = DEFAULT_FRAMES / DEFAULT_FPS;

// RunningAnimation: t = progress*15 + π/2
// Walk at π/20 → t=3π/4+π/2=5π/4: arms ±43° (other stride), body grounded
// Run at π/60 → t=3π/4: arms ±61°, body at y=0
const WALK_POSE = Math.PI / 120;
const RUN_POSE = Math.PI / 60;
// CrouchAnimation.showProgress reaches full crouch at progress = 0.125.
const CROUCH_POSE = 0.125;
// FlyingAnimation fully extends by ~progress 0.5; overshoot slightly to be safe.
const FLY_POSE = 1.5;
// IdleAnimation at progress=0: neutral standing with arms naturally away from the body.
const STAND_POSE = 0;

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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("GIF generation was cancelled.", "AbortError");
  }
}

function writeFrameToGif(
  gif: ReturnType<typeof GIFEncoder>,
  data: Uint8ClampedArray | Uint8Array,
  opts: {
    size: number;
    delay: number;
    background: Background;
  }
): void {
  const { size, delay, background } = opts;
  const transparent = background.kind === "transparent";
  const format = frameFormat(background);
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
}

/** Encodes pre-captured RGBA frames into a looping GIF. DOM-free and unit-testable. */
export async function encodeFramesToGif(
  frames: Array<Uint8ClampedArray | Uint8Array>,
  opts: {
    size: number;
    fps: number;
    background: Background;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  }
): Promise<Uint8Array> {
  const { size, fps, background, onProgress, signal } = opts;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  for (let i = 0; i < frames.length; i++) {
    throwIfAborted(signal);
    writeFrameToGif(gif, frames[i], { size, delay, background });

    onProgress?.((i + 1) / frames.length);
    if (i % 4 === 3) {
      await yieldToUi();
      throwIfAborted(signal);
    }
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
 * A resolved pose animation. Cyclic poses have a CycleFn driven per frame;
 * held poses store the animation and progress value to freeze at.
 * Exactly one of `cycle` / `held` is non-null.
 */
export interface PoseAnimation {
  cycle: CycleFn | null;
  held: { anim: InstanceType<Skinview3d["PlayerAnimation"]>; pose: number } | null;
}

/** True when the pose+orbit combination produces a multi-frame animation. */
export function isAnimated(poseAnim: PoseAnimation, orbit: boolean): boolean {
  return poseAnim.cycle !== null || orbit;
}

/** Maps a pose to its animation. Single source of truth shared by preview and export. */
export function createPoseAnimation(sv: Skinview3d, pose: Pose): PoseAnimation {
  switch (pose) {
    case "sneak": {
      const anim = new sv.CrouchAnimation();
      anim.showProgress = true; // smooth depth, not the stepwise floor
      return { cycle: null, held: { anim, pose: CROUCH_POSE } };
    }
    case "fly":
      return { cycle: null, held: { anim: new sv.FlyingAnimation(), pose: FLY_POSE } };
    case "stand":
      return { cycle: null, held: { anim: new sv.IdleAnimation(), pose: STAND_POSE } };
    case "walk":
      return { cycle: null, held: { anim: new sv.RunningAnimation(), pose: WALK_POSE } };
    case "run":
    default:
      return { cycle: null, held: { anim: new sv.RunningAnimation(), pose: RUN_POSE } };
  }
}

/**
 * Settles a held pose once. Must be called after assigning the animation to the
 * viewer — assignment resets joints. No-op for cyclic poses.
 */
export function settleHeldPose(poseAnim: PoseAnimation, playerObject: PlayerObject): void {
  if (poseAnim.held) {
    poseAnim.held.anim.progress = poseAnim.held.pose;
    poseAnim.held.anim.update(playerObject, 0);
  }
}

/** Positions the player for one loop frame at phase t ∈ [0, 1). */
export function applyLoopFrame(
  targets: LoopTargets,
  poseAnim: PoseAnimation,
  t: number,
  opts: { orbit: boolean; upsideDown: boolean }
): void {
  poseAnim.cycle?.(targets, t);
  if (opts.orbit) targets.playerWrapper.rotation.y = orbitRotationForPhase(t);
  if (opts.upsideDown) targets.playerObject.rotation.z = Math.PI;
}

/** Resizes the viewer's drawing buffer and returns a cleanup thunk. */
function resizeViewer(viewer: SkinViewer, size: number) {
  const renderer = viewer.renderer;
  const prev = {
    width: viewer.width,
    height: viewer.height,
    pixelRatio: renderer.getPixelRatio(),
    background: viewer.background,
    renderPaused: viewer.renderPaused,
  };
  viewer.renderPaused = true;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  viewer.composer.setPixelRatio(1);
  viewer.composer.setSize(size, size);
  viewer.fxaaPass.material.uniforms["resolution"].value.set(1 / size, 1 / size);
  return prev;
}

function restoreViewer(viewer: SkinViewer, prev: ReturnType<typeof resizeViewer>) {
  viewer.background = prev.background;
  viewer.renderer.setPixelRatio(prev.pixelRatio);
  viewer.setSize(prev.width, prev.height);
  viewer.renderPaused = prev.renderPaused;
}

/**
 * Captures a single PNG frame from the live preview viewer.
 * Only the drawing buffer is resized so the on-screen layout never shifts.
 */
export async function captureViewerPng(
  viewer: SkinViewer,
  poseAnim: PoseAnimation,
  opts: CaptureOptions
): Promise<Blob> {
  const { upsideDown, background, size = DEFAULT_GIF_SIZE, onProgress, signal } = opts;
  const prev = resizeViewer(viewer, size);
  try {
    throwIfAborted(signal);
    viewer.background = background.kind === "color" ? background.color : null;
    applyLoopFrame(viewer, poseAnim, 0, { orbit: false, upsideDown });
    viewer.render();
    throwIfAborted(signal);
    const blob = await new Promise<Blob>((resolve, reject) => {
      viewer.canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
        "image/png"
      );
    });
    onProgress?.(1);
    return blob;
  } finally {
    restoreViewer(viewer, prev);
  }
}

/**
 * Captures a seamless looping GIF from the live preview viewer.
 * Only the drawing buffer is resized (`setSize(..., false)` skips canvas CSS)
 * so the on-screen layout never shifts. Everything is restored in the finally block.
 */
export async function captureViewerGif(
  viewer: SkinViewer,
  poseAnim: PoseAnimation,
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
    signal,
  } = opts;

  const prev = resizeViewer(viewer, size);

  const capture = document.createElement("canvas");
  capture.width = size;
  capture.height = size;
  const ctx = capture.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  const frameCount = frames;

  try {
    throwIfAborted(signal);
    viewer.background = background.kind === "color" ? background.color : null;

    for (let i = 0; i < frameCount; i++) {
      throwIfAborted(signal);
      applyLoopFrame(viewer, poseAnim, i / frameCount, { orbit, upsideDown });
      viewer.render();

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(viewer.canvas, 0, 0, size, size);
      writeFrameToGif(gif, ctx.getImageData(0, 0, size, size).data, {
        size,
        delay,
        background,
      });

      onProgress?.((i + 1) / frameCount);
      await yieldToUi();
    }

    throwIfAborted(signal);
    gif.finish();
    const bytes = gif.bytes();
    return new Blob([bytes as BlobPart], { type: "image/gif" }); // gifenc returns a plain buffer; cast is safe
  } finally {
    restoreViewer(viewer, prev);
  }
}
