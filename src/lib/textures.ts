const MOJANG_TEXTURE_HOST = "textures.minecraft.net";
const MOJANG_TEXTURE_PATH = /^\/texture\/[0-9a-f]+$/i;
const MAX_TEXTURE_BYTES = 1_048_576;
const MAX_TEXTURE_DIMENSION = 1024;
const TEXTURE_FETCH_TIMEOUT_MS = 10_000;
const MINECRAFT_TEXTURE_TYPES = new Set([
  "image/png",
  "application/octet-stream",
  "binary/octet-stream",
]);

/** Upgrade Mojang's `http://` texture URLs to `https://` (avoids mixed content). */
export function httpsify(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

export function toMojangTextureUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(httpsify(url));
  } catch {
    throw new Error("Texture URL must be a valid Mojang texture URL.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== MOJANG_TEXTURE_HOST ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !MOJANG_TEXTURE_PATH.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Texture URL must come from Mojang's texture CDN.");
  }

  return parsed.href;
}

/**
 * Fetches a texture and returns a same-origin object URL.
 *
 * Mojang's texture CDN (`textures.minecraft.net`) is CORS-enabled, and routing
 * the image through a blob object URL guarantees the WebGL canvas is never
 * tainted — which is what lets us read pixels back for the GIF export.
 */
export async function fetchAsObjectURL(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const safeUrl = toMojangTextureUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEXTURE_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetchImpl(safeUrl, { signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("Texture fetch timed out.");
    }
    throw err;
  }

  if (!res.ok) {
    clearTimeout(timeout);
    throw new Error(`Texture fetch failed (HTTP ${res.status}).`);
  }

  try {
    assertTextureHeaders(res);
    const blob = await res.blob();
    await assertTextureBlob(blob);
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timeout);
  }
}

function assertTextureHeaders(res: Response): void {
  const length = res.headers.get("content-length");
  if (length) {
    const bytes = Number(length);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_TEXTURE_BYTES) {
      throw new Error("Texture response is too large.");
    }
  }

  const type = mediaType(res.headers.get("content-type"));
  if (type && !MINECRAFT_TEXTURE_TYPES.has(type)) {
    throw new Error("Texture response must be a Minecraft texture image.");
  }
}

async function assertTextureBlob(blob: Blob): Promise<void> {
  if (blob.size > MAX_TEXTURE_BYTES) {
    throw new Error("Texture response is too large.");
  }

  const type = mediaType(blob.type);
  if (type && !MINECRAFT_TEXTURE_TYPES.has(type)) {
    throw new Error("Texture response must be a Minecraft texture image.");
  }

  const { width, height } = await readImageDimensions(blob);
  if (!isMinecraftTextureSize(width, height)) {
    throw new Error("Texture image dimensions are not valid for a Minecraft texture.");
  }
}

function mediaType(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isMinecraftTextureSize(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 64 &&
    height >= 32 &&
    width <= MAX_TEXTURE_DIMENSION &&
    height <= MAX_TEXTURE_DIMENSION &&
    width % 32 === 0 &&
    height % 32 === 0 &&
    (width === height || width === height * 2)
  );
}

async function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  if (typeof Image === "undefined") {
    throw new Error("Texture image dimensions could not be validated.");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Texture image could not be decoded."));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
