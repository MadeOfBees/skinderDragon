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
