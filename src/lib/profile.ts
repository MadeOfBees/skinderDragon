import { resolveTextures, ProfileError } from "./providers";
import { fetchAsObjectURL } from "./textures";

export { ProfileError };

export interface MinecraftProfile {
  uuid: string;
  username: string;
  /** `true` = slim ("Alex") arms, `false` = classic ("Steve") arms. */
  slim: boolean;
  /** Object URL for the skin texture (same-origin → safe for canvas export). */
  skinUrl: string;
  /** Object URL for the cape texture, or `null` if the player has no cape. */
  capeUrl: string | null;
}

/**
 * Resolves a username to a renderable profile: the IDs/model come from Mojang
 * (via playerdb), and the skin/cape images are downloaded from Mojang's
 * official CDN as object URLs so the export canvas stays untainted.
 */
export async function fetchProfile(rawName: string): Promise<MinecraftProfile> {
  const resolved = await resolveTextures(rawName);

  const skinUrl = await fetchAsObjectURL(resolved.skinTextureUrl);

  let capeUrl: string | null = null;
  if (resolved.capeTextureUrl) {
    try {
      capeUrl = await fetchAsObjectURL(resolved.capeTextureUrl);
    } catch {
      // A cape that fails to download is non-fatal — render without it.
      capeUrl = null;
    }
  }

  return {
    uuid: resolved.uuid,
    username: resolved.username,
    slim: resolved.slim,
    skinUrl,
    capeUrl,
  };
}
