import { resolveTextures, ProfileError, type Edition } from "./providers";
import { fetchAsObjectURL } from "./textures";

export { ProfileError };

export interface MinecraftProfile {
  /** Java UUID (dashed) for Java; XUID string for Bedrock. */
  playerId: string;
  username: string;
  /** `true` = slim ("Alex") arms, `false` = classic ("Steve") arms. */
  slim: boolean;
  /** Object URL for the skin texture (same-origin → safe for canvas export). */
  skinUrl: string;
  /** Object URL for the cape texture, or `null` if the player has no cape. */
  capeUrl: string | null;
}

export async function fetchProfile(
  rawName: string,
  edition: Edition = "java"
): Promise<MinecraftProfile> {
  const resolved = await resolveTextures(rawName, fetch, edition);

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
    playerId: resolved.playerId,
    username: resolved.username,
    slim: resolved.slim,
    skinUrl,
    capeUrl,
  };
}
