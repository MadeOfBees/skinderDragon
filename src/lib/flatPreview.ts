// Flat 2D previews rendered from skin / cape textures: the player head, a
// front-facing "paper doll" of the whole skin, and the cape's front face.
// Each is composited on a 2D canvas, scaled up with nearest-neighbor so the
// pixel art stays crisp. All three return a PNG data URL, or `null` on failure.

/**
 * Loads `url` into an <img>, hands a sized 2D canvas to `paint`, and resolves
 * to the canvas as a PNG data URL. Resolves `null` on any load/decode failure
 * or if a 2D context is unavailable. Smoothing is disabled for crisp upscaling.
 *
 * `paint` receives the loaded image, the context, and `unit` — the texture's
 * scale relative to a 64-wide sheet — so HD skins/capes map correctly.
 */
function paintFromTexture(
  url: string,
  width: number,
  height: number,
  paint: (img: HTMLImageElement, ctx: CanvasRenderingContext2D, unit: number) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.imageSmoothingEnabled = false;
        paint(img, ctx, img.width / 64 || 1);
        resolve(canvas.toDataURL());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renders a Minecraft-style player head (the 8×8 face plus the hat overlay)
 * from a skin texture — like the heads shown in the multiplayer player list.
 *
 * Works for both 64×64 and legacy 64×32 skins: the face lives at (8,8) and the
 * hat layer at (40,8) in skin-texture pixels regardless.
 */
export function renderHead(skinUrl: string, size = 64): Promise<string | null> {
  return paintFromTexture(skinUrl, size, size, (img, ctx, unit) => {
    ctx.drawImage(img, 8 * unit, 8 * unit, 8 * unit, 8 * unit, 0, 0, size, size);
    ctx.drawImage(img, 40 * unit, 8 * unit, 8 * unit, 8 * unit, 0, 0, size, size);
  });
}

/**
 * Renders a flat, front-facing 2D "paper doll" of the player — head, body,
 * arms and legs (base layer + 2nd-layer overlay) composited from their front
 * faces on the skin sheet.
 *
 * Front-face regions on the 64×64 sheet (texture pixels). Base layer:
 *   head (8,8,8,8)   body (20,20,8,12)
 *   right arm (44,20,W,12)   left arm (36,52,W,12)
 *   right leg (4,20,4,12)    left leg (20,52,4,12)
 * Overlay layer, the same boxes shifted to the 2nd-layer regions:
 *   hat (40,8,8,8)   jacket (20,36,8,12)
 *   right sleeve (44,36,W,12)   left sleeve (52,52,W,12)
 *   right pants (4,36,4,12)     left pants (4,52,4,12)
 * where W = 3 for slim ("Alex") arms, else 4.
 *
 * The doll is (W + 8 + W) model units wide and 32 tall: the arms flank the
 * 8-wide torso — the player's right limbs sit on the viewer's left, as in a
 * real front view — and the head and legs sit centered above and below it,
 * leaving transparent margins on the head/leg rows. A slim skin is always
 * 64×64, so W (and thus the canvas width) is fixed by `slim` before the texture
 * loads, letting us reuse `paintFromTexture`.
 *
 * Legacy 64×32 sheets have no left limbs and no 2nd layer beyond the hat, so
 * the left arm/leg are mirrored from the right and only the hat is overlaid.
 */
export function renderBody(
  skinUrl: string,
  slim: boolean,
  scale = 8
): Promise<string | null> {
  const W = slim ? 3 : 4;
  const cw = (8 + 2 * W) * scale;
  const ch = 32 * scale;
  return paintFromTexture(skinUrl, cw, ch, (img, ctx, unit) => {
    const legacy = img.height * 2 === img.width; // 64×32 / HD 128×64

    // Copy a front-face rect (texture px) to its dest box (model units).
    const part = (
      sx: number, sy: number, sw: number, sh: number, dx: number, dy: number
    ) =>
      ctx.drawImage(
        img, sx * unit, sy * unit, sw * unit, sh * unit,
        dx * scale, dy * scale, sw * scale, sh * scale
      );
    // Same, mirrored horizontally — legacy left limbs reuse the right faces.
    const mirror = (
      sx: number, sy: number, sw: number, sh: number, dx: number, dy: number
    ) => {
      ctx.save();
      ctx.translate((dx + sw) * scale, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        img, sx * unit, sy * unit, sw * unit, sh * unit,
        0, dy * scale, sw * scale, sh * scale
      );
      ctx.restore();
    };

    // Base layer. Arms flank the torso, so draw order is cosmetic.
    part(20, 20, 8, 12, W, 8); // torso
    part(4, 20, 4, 12, W, 20); // right leg
    part(44, 20, W, 12, 0, 8); // right arm
    if (legacy) {
      mirror(4, 20, 4, 12, W + 4, 20); // left leg
      mirror(44, 20, W, 12, W + 8, 8); // left arm
    } else {
      part(20, 52, 4, 12, W + 4, 20); // left leg
      part(36, 52, W, 12, W + 8, 8); // left arm
    }
    part(8, 8, 8, 8, W, 0); // head

    // 2nd layer: hat on every skin; the rest only on modern 64×64 sheets.
    part(40, 8, 8, 8, W, 0); // hat
    if (!legacy) {
      part(20, 36, 8, 12, W, 8); // jacket
      part(4, 36, 4, 12, W, 20); // right pants
      part(4, 52, 4, 12, W + 4, 20); // left pants
      part(44, 36, W, 12, 0, 8); // right sleeve
      part(52, 52, W, 12, W + 8, 8); // left sleeve
    }
  });
}

/**
 * Renders the front face of a cape from a cape texture. The cape front lives
 * at (1,1) and is 10×16 texture pixels on the standard 64×32 sheet; scaling
 * from the actual texture width makes larger (HD) sheets work too. Output
 * keeps the 10:16 cape aspect ratio.
 */
export function renderCape(capeUrl: string, scale = 8): Promise<string | null> {
  const w = 10 * scale;
  const h = 16 * scale;
  return paintFromTexture(capeUrl, w, h, (img, ctx, unit) => {
    ctx.drawImage(img, 1 * unit, 1 * unit, 10 * unit, 16 * unit, 0, 0, w, h);
  });
}
