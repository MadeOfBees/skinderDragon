import { describe, it, expect, vi } from "vitest";

// Avoid pulling three.js into the test; we only exercise the pure helpers
// and the DOM-free gifenc encoding path here.
vi.mock("skinview3d", () => ({ SkinViewer: class {} }));

import {
  orbitRotationForPhase,
  frameFormat,
  pickTransparentIndex,
  encodeFramesToGif,
} from "./exportGif";
// Shared with the headless smoke so the GIF byte-parsing lives in one place.
import { analyzeGif } from "../../scripts/analyze-gif.mjs";

describe("orbit phase math", () => {
  it("spans a full turn across the loop (t: 0→1)", () => {
    expect(orbitRotationForPhase(0)).toBe(0);
    expect(orbitRotationForPhase(1)).toBeCloseTo(Math.PI * 2, 10);
    expect(orbitRotationForPhase(0.5)).toBeCloseTo(Math.PI, 10);
  });
});

describe("encoder helpers", () => {
  it("selects the right pixel format per background", () => {
    expect(frameFormat({ kind: "transparent" })).toBe("rgba4444");
    expect(frameFormat({ kind: "color", color: "#000" })).toBe("rgb565");
  });

  it("finds the fully-transparent palette entry", () => {
    expect(pickTransparentIndex([[1, 2, 3], [0, 0, 0, 0], [9, 9, 9]])).toBe(1);
    expect(pickTransparentIndex([[1, 2, 3], [9, 9, 9]])).toBe(-1);
  });
});

function solidFrame(size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 60;
    data[i + 2] = 40;
    data[i + 3] = 255;
  }
  return data;
}

function partlyTransparentFrame(size: number): Uint8ClampedArray {
  const data = solidFrame(size);
  data[3] = 0; // first pixel fully transparent
  return data;
}

describe("encodeFramesToGif", () => {
  it("produces a valid, looping GIF for a solid background", async () => {
    const size = 2;
    const bytes = await encodeFramesToGif([solidFrame(size), solidFrame(size)], {
      size,
      fps: 12,
      background: { kind: "color", color: "#1d2030" },
    });
    const info = analyzeGif(bytes);
    expect(info.header).toBe("GIF89a");
    expect(info.looping).toBe(true);
    expect(bytes.length).toBeGreaterThan(20);
  });

  it("writes a transparency flag for a transparent background", async () => {
    const size = 2;
    const bytes = await encodeFramesToGif([partlyTransparentFrame(size)], {
      size,
      fps: 12,
      background: { kind: "transparent" },
    });
    const info = analyzeGif(bytes);
    expect(info.header).toBe("GIF89a");
    expect(info.transparent).toBe(true);
  });

  it("reports progress for every frame", async () => {
    const size = 2;
    const onProgress = vi.fn();
    await encodeFramesToGif([solidFrame(size), solidFrame(size), solidFrame(size)], {
      size,
      fps: 12,
      background: { kind: "color", color: "#000000" },
      onProgress,
    });
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });
});
