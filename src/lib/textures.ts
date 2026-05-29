/** Upgrade Mojang's `http://` texture URLs to `https://` (avoids mixed content). */
export function httpsify(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
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
  const res = await fetchImpl(httpsify(url));
  if (!res.ok) {
    throw new Error(`Texture fetch failed (HTTP ${res.status}).`);
  }
  return URL.createObjectURL(await res.blob());
}
