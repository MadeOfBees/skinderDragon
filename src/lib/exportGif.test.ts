import { describe, it, expect, vi } from "vitest";

// Avoid pulling three.js into the test; we only exercise the pure helpers
// and the DOM-free gifenc encoding path here.
vi.mock("skinview3d", () => ({ SkinViewer: class {}, WalkingAnimation: class {} }));

import {
  WALK_CYCLE,
  walkProgressForFrame,
  orbitRotationForFrame,
  frameFormat,
  pickTransparentIndex,
  encodeFramesToGif,
} from "./exportGif";

describe("frame math", () => {
  it("walk progress spans exactly one limb cycle across the loop", () => {
    expect(walkProgressForFrame(0, 30)).toBe(0);
    expect(walkProgressForFrame(30, 30)).toBeCloseTo(WALK_CYCLE, 10);
    expect(walkProgressForFrame(15, 30)).toBeCloseTo(WALK_CYCLE / 2, 10);
  });

  it("orbit rotation spans a full turn across the loop", () => {
    expect(orbitRotationForFrame(0, 30)).toBe(0);
    expect(orbitRotationForFrame(30, 30)).toBeCloseTo(Math.PI * 2, 10);
    expect(orbitRotationForFrame(15, 30)).toBeCloseTo(Math.PI, 10);
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

/** Minimal GIF byte inspector (header / loop / transparency flag). */
function analyzeGif(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.slice(0, 6));
  const txt = String.fromCharCode(...bytes.slice(0, 256));
  let transparent = false;
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
      if (bytes[i + 3] & 0x01) transparent = true;
    }
  }
  return { header, looping: txt.includes("NETSCAPE2.0"), transparent };
}

function solidFrame(size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200; // r
    data[i + 1] = 60; // g
    data[i + 2] = 40; // b
    data[i + 3] = 255; // a
  }
  return data;
}

function partlyTransparentFrame(size: number): Uint8ClampedArray {
  const data = solidFrame(size);
  // Make the first pixel fully transparent.
  data[3] = 0;
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
