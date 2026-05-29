// Resolves a Minecraft username to the official Mojang texture URLs.
//
// Mojang's own lookup endpoints (api.mojang.com / sessionserver) don't send
// CORS headers, so a static browser app can't call them directly. We use
// playerdb.co — a CORS-enabled wrapper that returns Mojang's data unmodified,
// including the canonical `textures.minecraft.net` URLs. The actual skin/cape
// PNGs are then downloaded from that official CDN (see `textures.ts`).
//
// This module is the single seam for the data source: swapping playerdb for a
// generic CORS proxy or a self-hosted worker means changing only `resolveTextures`.

export interface ResolvedTextures {
  /** Dashed UUID. */
  uuid: string;
  /** Canonical username casing as Mojang stores it. */
  username: string;
  /** `true` = slim ("Alex") arms, `false` = classic ("Steve") arms. */
  slim: boolean;
  /** Official textures.minecraft.net URL for the skin. */
  skinTextureUrl: string;
  /** Official textures.minecraft.net URL for the cape, or `null`. */
  capeTextureUrl: string | null;
}

export class ProfileError extends Error {}

/** Minecraft usernames: 1–16 of [A-Za-z0-9_]. */
export const USERNAME_RE = /^[A-Za-z0-9_]{1,16}$/;

const PLAYERDB = "https://playerdb.co/api/player/minecraft/";

interface PlayerDbResponse {
  success: boolean;
  code: string;
  message: string;
  data: {
    player?: {
      id: string;
      raw_id: string;
      username: string;
      properties: { name: string; value: string }[];
    };
  };
}

interface MojangTextures {
  textures: {
    SKIN?: { url: string; metadata?: { model?: string } };
    CAPE?: { url: string };
  };
}

/** Decodes a base64 `textures` property value into its skin/cape URLs + model. */
export function decodeTexturesProperty(base64Value: string): {
  skinUrl: string;
  capeUrl: string | null;
  slim: boolean;
} {
  let decoded: MojangTextures;
  try {
    decoded = JSON.parse(atob(base64Value)) as MojangTextures;
  } catch {
    throw new ProfileError("Could not read this player's skin data.");
  }
  const skin = decoded.textures?.SKIN;
  if (!skin?.url) throw new ProfileError("This player has no skin.");
  return {
    skinUrl: skin.url,
    capeUrl: decoded.textures.CAPE?.url ?? null,
    slim: skin.metadata?.model === "slim",
  };
}

export async function resolveTextures(
  rawName: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedTextures> {
  const name = rawName.trim();
  if (!name) throw new ProfileError("Enter a username.");
  if (!USERNAME_RE.test(name)) {
    throw new ProfileError(
      "Usernames are 1–16 characters: letters, numbers and underscores only."
    );
  }

  let res: Response;
  try {
    res = await fetchImpl(PLAYERDB + encodeURIComponent(name));
  } catch {
    throw new ProfileError("Network error — check your connection and try again.");
  }

  let body: PlayerDbResponse | null = null;
  try {
    body = (await res.json()) as PlayerDbResponse;
  } catch {
    body = null;
  }

  // playerdb answers unknown players with HTTP 400 and success:false.
  if (res.status === 400 || body?.success === false) {
    throw new ProfileError(`No Minecraft player named “${name}”.`);
  }
  if (!res.ok || !body?.data?.player) {
    throw new ProfileError(`Lookup failed (HTTP ${res.status}). Try again shortly.`);
  }

  const player = body.data.player;
  const texturesProp = player.properties.find((p) => p.name === "textures");
  if (!texturesProp) throw new ProfileError("This player has no skin data.");

  const { skinUrl, capeUrl, slim } = decodeTexturesProperty(texturesProp.value);

  return {
    uuid: player.id,
    username: player.username,
    slim,
    skinTextureUrl: skinUrl,
    capeTextureUrl: capeUrl,
  };
}
