import { GIFEncoder, quantize, applyPalette, type PixelFormat } from "gifenc";
import { loadSkinview3d } from "./skinview";

export type AnimationMode = "run" | "orbit";

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string };

export interface GifOptions {
  skinUrl: string;
  capeUrl: string | null;
  slim: boolean;
  mode: AnimationMode;
  background: Background;
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
 * Renders a Minecraft player to a seamless looping GIF, either running in
 * place or frozen mid-stride while the camera orbits.
 */
export async function generateGif(opts: GifOptions): Promise<Blob> {
  const {
    skinUrl,
    capeUrl,
    slim,
    mode,
    background,
    size = 512,
    frames = 30,
    fps = 12,
    onProgress,
  } = opts;

  const { SkinViewer, WalkingAnimation } = await loadSkinview3d();
  const canvas = document.createElement("canvas");
  const viewer = new SkinViewer({
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

    const anim = new WalkingAnimation();
    anim.headBobbing = false; // long-period head bob would break the short loop
    viewer.animation = anim;

    if (mode === "orbit") {
      anim.progress = FROZEN_PROGRESS;
      anim.update(viewer.playerObject, 0); // freeze the pose once
    }

    const capture = document.createElement("canvas");
    capture.width = size;
    capture.height = size;
    const ctx = capture.getContext("2d", { willReadFrequently: true })!;

    const rgbaFrames: Uint8ClampedArray[] = [];
    for (let i = 0; i < frames; i++) {
      if (mode === "run") {
        anim.progress = walkProgressForFrame(i, frames);
        anim.update(viewer.playerObject, 0);
      } else {
        viewer.playerObject.rotation.y = orbitRotationForFrame(i, frames);
      }
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
