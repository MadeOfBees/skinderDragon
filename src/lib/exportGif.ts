import { GIFEncoder, quantize, applyPalette, type PixelFormat } from "gifenc";
import { loadSkinview3d } from "./skinview";

export type AnimationMode = "run" | "orbit" | "wave" | "sneak" | "fly";

/** Modes that animate the limbs in place (a seamless loop), vs. orbit a pose. */
const CYCLE_MODES = new Set<AnimationMode>(["run", "wave"]);

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string };

export interface GifOptions {
  skinUrl: string;
  capeUrl: string | null;
  slim: boolean;
  mode: AnimationMode;
  background: Background;
  /** Render the player flipped (the Dinnerbone/Grumm easter egg). */
  upsideDown?: boolean;
  /** Output is a square of this many pixels. @default 512 */
  size?: number;
  /** Number of frames in the loop. @default 30 */
  frames?: number;
  /** Frames per second. @default 12 */
  fps?: number;
  /** Reports 0→1 progress across capture + encode. */
  onProgress?: (fraction: number) => void;
}

// WalkingAnimation drives limbs with sin(progress * 8), so one full limb cycle
// spans a progress interval of 2π / 8 = π/4. Looping over exactly this interval
// yields a seamless run cycle.
export const WALK_CYCLE = Math.PI / 4;
// Mid-stride pose (sin peak → maximum limb extension) for the frozen orbit.
export const FROZEN_PROGRESS = Math.PI / 16;
// WaveAnimation drives the arm with sin(progress * π); one full wave spans a
// progress interval of 2 — looping over it yields a seamless wave.
export const WAVE_CYCLE = 2;
// Progress values at which the (non-cyclic) crouch/fly animations have settled
// into their pose, so we can freeze them and orbit the camera around the pose.
export const SNEAK_POSE = 1;
export const FLY_POSE = 2;

/** Walk-animation progress for frame `i` of `frames` of a given cycle length. */
function cycleProgressForFrame(i: number, frames: number, cycle: number): number {
  return (i / frames) * cycle;
}

/** Walk-animation progress for frame `i` of `frames` (one seamless cycle). */
export function walkProgressForFrame(i: number, frames: number): number {
  return (i / frames) * WALK_CYCLE;
}

/** Player y-rotation (radians) for frame `i` of `frames` (one full turn). */
export function orbitRotationForFrame(i: number, frames: number): number {
  return (i / frames) * Math.PI * 2;
}

/** gifenc pixel format for a given background. */
export function frameFormat(background: Background): PixelFormat {
  return background.kind === "transparent" ? "rgba4444" : "rgb565";
}

/** Index of the fully-transparent palette entry, or -1 if there is none. */
export function pickTransparentIndex(palette: number[][]): number {
  return palette.findIndex((c) => c.length >= 4 && c[3] === 0);
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Encodes pre-captured RGBA frames into a looping GIF. DOM-free (no
 * canvas/WebGL) so it's unit-testable; yields periodically to keep the UI
 * responsive and the progress bar animating during the encode.
 */
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
      repeat: 0, // loop forever
      transparent: transparent && transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : undefined,
    });

    onProgress?.((i + 1) / frames.length);
    if (i % 4 === 3) await yieldToUi();
  }

  gif.finish();
  return gif.bytes();
}

/**
 * Builds the animation for a given mode and reports how to drive it: either a
 * seamless limb cycle (run/wave) or a frozen pose the camera orbits (orbit/
 * sneak/fly).
 */
function buildAnimation(
  sv: Awaited<ReturnType<typeof loadSkinview3d>>,
  mode: AnimationMode
): { anim: InstanceType<typeof sv.PlayerAnimation>; cycle: number; pose: number } {
  switch (mode) {
    case "wave":
      return { anim: new sv.WaveAnimation(), cycle: WAVE_CYCLE, pose: 0 };
    case "sneak":
      return { anim: new sv.CrouchAnimation(), cycle: 0, pose: SNEAK_POSE };
    case "fly":
      return { anim: new sv.FlyingAnimation(), cycle: 0, pose: FLY_POSE };
    case "orbit":
    case "run":
    default: {
      const anim = new sv.WalkingAnimation();
      anim.headBobbing = false; // long-period head bob would break the short loop
      return { anim, cycle: WALK_CYCLE, pose: FROZEN_PROGRESS };
    }
  }
}

/**
 * Renders a Minecraft player to a seamless looping GIF. Cyclic modes (run, wave)
 * animate the limbs in place; posed modes (orbit, sneak, fly) freeze the pose
 * and orbit the camera around it.
 */
export async function generateGif(opts: GifOptions): Promise<Blob> {
  const {
    skinUrl,
    capeUrl,
    slim,
    mode,
    background,
    upsideDown = false,
    size = 512,
    frames = 30,
    fps = 12,
    onProgress,
  } = opts;

  const sv = await loadSkinview3d();
  const canvas = document.createElement("canvas");
  const viewer = new sv.SkinViewer({
    canvas,
    width: size,
    height: size,
    pixelRatio: 1,
    preserveDrawingBuffer: true, // required to read pixels back reliably
    renderPaused: true, // we drive every frame by hand
    enableControls: false,
    fov: 40,
    zoom: 0.7,
    background: background.kind === "color" ? background.color : undefined,
  });

  try {
    await viewer.loadSkin(skinUrl, { model: slim ? "slim" : "default" });
    if (capeUrl) await viewer.loadCape(capeUrl);

    const { anim, cycle, pose } = buildAnimation(sv, mode);
    viewer.animation = anim;

    const cyclic = CYCLE_MODES.has(mode);
    if (!cyclic) {
      anim.progress = pose;
      anim.update(viewer.playerObject, 0); // settle into the pose once
    }
    const flip = () => {
      if (upsideDown) viewer.playerObject.rotation.z = Math.PI;
    };
    flip();

    const capture = document.createElement("canvas");
    capture.width = size;
    capture.height = size;
    const ctx = capture.getContext("2d", { willReadFrequently: true })!;

    const rgbaFrames: Uint8ClampedArray[] = [];
    for (let i = 0; i < frames; i++) {
      if (cyclic) {
        anim.progress = cycleProgressForFrame(i, frames, cycle);
        anim.update(viewer.playerObject, 0);
      } else {
        viewer.playerObject.rotation.y = orbitRotationForFrame(i, frames);
      }
      flip(); // keep the easter-egg flip stable across frames
      viewer.render();

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(viewer.canvas, 0, 0, size, size);
      rgbaFrames.push(ctx.getImageData(0, 0, size, size).data);

      onProgress?.((i + 1) / frames / 2); // capture is the first half
      await yieldToUi();
    }

    const bytes = await encodeFramesToGif(rgbaFrames, {
      size,
      fps,
      background,
      onProgress: (f) => onProgress?.(0.5 + f / 2),
    });
    return new Blob([bytes], { type: "image/gif" });
  } finally {
    viewer.dispose();
  }
}
