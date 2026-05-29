// Minimal GIF byte inspector — validity, loop extension, and transparency flag.
// Shared by the headless smoke (scripts/smoke.mjs) and the gifenc unit test
// (src/lib/exportGif.test.ts) so the parsing lives in exactly one place. Accepts
// a Uint8Array or a plain byte array (the smoke pulls bytes back from the page
// as an array).
export function analyzeGif(bytes) {
  const b = Uint8Array.from(bytes);
  const header = String.fromCharCode(...b.slice(0, 6));
  const valid = header === "GIF89a" || header === "GIF87a";
  // NETSCAPE2.0 application extension = looping. Scan well past the global
  // colour table (up to 256 entries × 3 bytes) so we don't miss it.
  const txt = String.fromCharCode(...b.slice(0, Math.min(b.length, 4000)));
  const looping = txt.includes("NETSCAPE2.0");
  // A Graphic Control Extension (0x21 0xF9 0x04) with bit 0 of the packed field
  // set means the frame declares a transparent colour.
  let transparent = false;
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04) {
      if (b[i + 3] & 0x01) transparent = true;
    }
  }
  return { valid, header, looping, transparent, size: b.length };
}
