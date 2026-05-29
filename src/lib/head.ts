/**
 * Renders a Minecraft-style player head (the 8×8 face plus the hat overlay)
 * from a skin texture, scaled up with nearest-neighbor — like the heads shown
 * in the multiplayer player list. Returns a data URL, or `null` on failure.
 *
 * Works for both 64×64 and legacy 64×32 skins: the face lives at (8,8) and the
 * hat layer at (40,8) in skin-texture pixels regardless.
 */
export function renderHead(skinUrl: string, size = 64): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.imageSmoothingEnabled = false;
        // Scale the source from a 64-wide texture; the regions are fixed.
        const unit = img.width / 64 || 1;
        ctx.drawImage(img, 8 * unit, 8 * unit, 8 * unit, 8 * unit, 0, 0, size, size);
        ctx.drawImage(img, 40 * unit, 8 * unit, 8 * unit, 8 * unit, 0, 0, size, size);
        resolve(canvas.toDataURL());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = skinUrl;
  });
}

/**
 * Renders the front face of a cape from a cape texture, scaled up with
 * nearest-neighbor. Returns a data URL, or `null` on failure.
 *
 * The cape front lives at (1,1) and is 10×16 texture pixels on the standard
 * 64×32 cape sheet; we scale from the actual texture width so larger sheets
 * (HD capes) work too. Output keeps the 10:16 cape aspect ratio.
 */
export function renderCape(capeUrl: string, scale = 8): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const unit = img.width / 64 || 1;
        const w = 10 * scale;
        const h = 16 * scale;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 1 * unit, 1 * unit, 10 * unit, 16 * unit, 0, 0, w, h);
        resolve(canvas.toDataURL());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = capeUrl;
  });
}
