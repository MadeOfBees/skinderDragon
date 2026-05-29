import { GIFEncoder, quantize, applyPalette, type PixelFormat } from "gifenc";
import { loadSkinview3d } from "./skinview";

/** The limb/pose animation. Orbit is a separate toggle (see {@link GifOptions}). */
export type AnimationMode = "run" | "sneak" | "fly";

export type Background =
  | { kind: "transparent" }
  | { kind: "color"; color: string };

export interface GifOptions {
  skinUrl: string;
  capeUrl: string | null;
  slim: boolean;
  mode: AnimationMode;
  /** Spin the player a full turn across the loop (mixes with any mode). */
  orbit: boolean;
  /** Render the floating username tag above the player. */
  showNametag: boolean;
  /** Player name, used for the name tag. */
  username: string;
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
// CrouchAnimation with showProgress reaches a full crouch when progress*8 = 1,
// i.e. at progress = 0.125. We freeze there for a held sneak pose. (The default
// showProgress=false floors progress*8, so the old freeze at progress=1 landed
// on an *even* step → a standing pose, which is why sneak looked broken.)
export const CROUCH_POSE = 0.125;
// FlyingAnimation settles into its horizontal pose within ~0.5s (progress 0.5);
// we freeze a little past that so the elytra have finished expanding.
export const FLY_POSE = 1.5;

/** Animation progress for frame `i` of `frames` over a given cycle length. */
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

type Skinview3d = Awaited<ReturnType<typeof loadSkinview3d>>;

/** A mode's animation plus how to drive it: a seamless limb cycle, or a held pose. */
export interface ModeAnimation {
  anim: InstanceType<Skinview3d["PlayerAnimation"]>;
  /** `true` = limbs cycle over `pose`→one loop (run); `false` = settle+hold `pose`. */
  cyclic: boolean;
  /** Progress to settle a held pose at (ignored when `cyclic`). */
  pose: number;
}

/**
 * Builds the animation for a mode and classifies it as a seamless limb cycle
 * (run) or a held pose (sneak/fly). The single source of truth for the
 * mode→animation mapping, shared by the live preview and the GIF exporter; each
 * then drives it its own way (the preview pauses a held pose and plays the cycle
 * live; the exporter advances frames by hand). `headBobbing` is the only knob
 * that legitimately differs: the live preview can afford it, but its long period
 * would break the exporter's short seamless loop.
 */
export function createModeAnimation(
  sv: Skinview3d,
  mode: AnimationMode,
  opts: { headBobbing: boolean }
): ModeAnimation {
  switch (mode) {
    case "sneak": {
      const anim = new sv.CrouchAnimation();
      anim.showProgress = true; // smooth crouch depth, not the stepwise toggle
      return { anim, cyclic: false, pose: CROUCH_POSE };
    }
    case "fly":
      return { anim: new sv.FlyingAnimation(), cyclic: false, pose: FLY_POSE };
    case "run":
    default: {
      const anim = new sv.WalkingAnimation();
      anim.headBobbing = opts.headBobbing;
      return { anim, cyclic: true, pose: 0 };
    }
  }
}

/**
 * Renders a Minecraft player to a seamless looping GIF.
 *
 * The loop is composed of up to two independent, separately-seamless motions:
 *   • the mode's limb animation — run cycles its limbs; sneak/fly hold a pose;
 *   • orbit — an optional full turn of the player about the vertical axis.
 * Both complete a whole number of cycles across `frames`, so any combination
 * loops cleanly. When neither animates (a held pose with orbit off) we emit a
 * single frame instead of 30 identical ones.
 */
export async function generateGif(opts: GifOptions): Promise<Blob> {
  const {
    skinUrl,
    capeUrl,
    slim,
    mode,
    orbit,
    showNametag,
    username,
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
    // Pull back a touch when the name tag is shown so it doesn't clip the top.
    zoom: showNametag ? 0.6 : 0.7,
    background: background.kind === "color" ? background.color : undefined,
  });

  try {
    await viewer.loadSkin(skinUrl, { model: slim ? "slim" : "default" });
    if (capeUrl) await viewer.loadCape(capeUrl);

    const { anim, cyclic, pose } = createModeAnimation(sv, mode, { headBobbing: false });
    viewer.animation = anim; // resets pose + progress (configure AFTER this)
    if (!cyclic) {
      anim.progress = pose;
      anim.update(viewer.playerObject, 0); // settle into the held pose once
    }

    // The name tag is a sprite on playerWrapper; set it last so the animation
    // assignment above doesn't clobber its position. renderPaused skips the
    // draw loop, so we rely on the setter's default y-offset for placement.
    if (showNametag) {
      const tag = new sv.NameTagObject(username, {
        font: "48px Monocraft",
        repaintAfterLoaded: true,
      });
      viewer.nameTag = tag;
      await tag.painted; // wait for the pixel font before capturing
    }

    // Orbit spins the wrapper (keeping the centred name tag fixed); the flip
    // easter-egg spins the player itself. They compose independently.
    const orbitTo = (turn: number) => {
      if (orbit) viewer.playerWrapper.rotation.y = turn;
    };
    const flip = () => {
      if (upsideDown) viewer.playerObject.rotation.z = Math.PI;
    };
    flip();

    const capture = document.createElement("canvas");
    capture.width = size;
    capture.height = size;
    const ctx = capture.getContext("2d", { willReadFrequently: true })!;

    // A held pose with no orbit is a still image — one frame is enough.
    const animated = cyclic || orbit;
    const frameCount = animated ? frames : 1;

    const rgbaFrames: Uint8ClampedArray[] = [];
    for (let i = 0; i < frameCount; i++) {
      if (cyclic) {
        anim.progress = cycleProgressForFrame(i, frameCount, WALK_CYCLE);
        anim.update(viewer.playerObject, 0);
      }
      orbitTo(orbitRotationForFrame(i, frameCount));
      flip(); // keep the easter-egg flip stable across frames
      viewer.render();

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(viewer.canvas, 0, 0, size, size);
      rgbaFrames.push(ctx.getImageData(0, 0, size, size).data);

      onProgress?.((i + 1) / frameCount / 2); // capture is the first half
      await yieldToUi();
    }

    const bytes = await encodeFramesToGif(rgbaFrames, {
      size,
      fps,
      background,
      onProgress: (f) => onProgress?.(0.5 + f / 2),
    });
    // TS 5.7+ types `Uint8Array` as generic over its buffer (`ArrayBufferLike`,
    // which includes SharedArrayBuffer), but DOM's `BlobPart` wants a plain
    // `ArrayBuffer`. gifenc only ever returns a regular ArrayBuffer at runtime,
    // so the cast is safe.
    return new Blob([bytes as BlobPart], { type: "image/gif" });
  } finally {
    viewer.dispose();
  }
}
