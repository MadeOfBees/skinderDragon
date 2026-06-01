// Resolves a Minecraft username/gamertag to the official Mojang texture URLs.
//
// Java: Mojang's own lookup endpoints don't send CORS headers, so we use
// playerdb.co — a CORS-enabled wrapper that returns Mojang's data unmodified.
//
// Bedrock: Bedrock players use Xbox Live accounts. We use the GeyserMC Global
// API (api.geysermc.org, CORSPlug/*) to convert a gamertag → XUID → skin.
// GeyserMC only caches skins for players who have joined a Floodgate/GeyserMC
// server, so a player who has never done so will return an empty skin response.
//
// This module is the single seam for the data source.

import { toMojangTextureUrl } from "./textures";

export type Edition = "java" | "bedrock";

export interface ResolvedTextures {
  /** Java UUID (dashed) for Java players; XUID string for Bedrock players. */
  playerId: string;
  /** Canonical username / gamertag. */
  username: string;
  /** `true` = slim ("Alex") arms, `false` = classic ("Steve") arms. */
  slim: boolean;
  /** Official textures.minecraft.net URL for the skin. */
  skinTextureUrl: string;
  /** Official textures.minecraft.net URL for the cape, or `null`. */
  capeTextureUrl: string | null;
}

export class ProfileError extends Error {}

/** Java usernames: 1–16 of [A-Za-z0-9_]. */
export const USERNAME_RE = /^[A-Za-z0-9_]{1,16}$/;

/** Xbox gamertags: 1–16 of letters, digits, spaces. */
export const GAMERTAG_RE = /^[A-Za-z0-9 ]{1,16}$/;

const PLAYERDB = "https://playerdb.co/api/player/minecraft/";
const GEYSER = "https://api.geysermc.org/v2";

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

interface GeyserXuidResponse {
  xuid?: number;
}

interface GeyserSkinResponse {
  value?: string;
  is_steve?: boolean;
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
  try {
    return {
      skinUrl: toMojangTextureUrl(skin.url),
      capeUrl: decoded.textures.CAPE?.url
        ? toMojangTextureUrl(decoded.textures.CAPE.url)
        : null,
      slim: skin.metadata?.model === "slim",
    };
  } catch {
    throw new ProfileError("This player's texture URL is not from Mojang's CDN.");
  }
}

async function resolveJavaTextures(
  rawName: string,
  fetchImpl: typeof fetch
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

  if (res.status === 400 || body?.success === false) {
    throw new ProfileError(`No Minecraft player named "${name}".`);
  }
  if (!res.ok || !body?.data?.player) {
    throw new ProfileError(`Lookup failed (HTTP ${res.status}). Try again shortly.`);
  }

  const player = body.data.player;
  const texturesProp = player.properties.find((p) => p.name === "textures");
  if (!texturesProp) throw new ProfileError("This player has no skin data.");

  const { skinUrl, capeUrl, slim } = decodeTexturesProperty(texturesProp.value);

  return {
    playerId: player.id,
    username: player.username,
    slim,
    skinTextureUrl: skinUrl,
    capeTextureUrl: capeUrl,
  };
}

async function resolveBedrockTextures(
  rawName: string,
  fetchImpl: typeof fetch
): Promise<ResolvedTextures> {
  const name = rawName.trim();
  if (!name) throw new ProfileError("Enter a gamertag.");
  if (!GAMERTAG_RE.test(name)) {
    throw new ProfileError(
      "Gamertags are 1–16 characters: letters, numbers and spaces only."
    );
  }

  // Step 1: gamertag → XUID
  let xuidRes: Response;
  try {
    xuidRes = await fetchImpl(`${GEYSER}/xbox/xuid/${encodeURIComponent(name)}`);
  } catch {
    throw new ProfileError("Network error — check your connection and try again.");
  }

  if (!xuidRes.ok) {
    throw new ProfileError(`No Bedrock player named "${name}".`);
  }

  let xuidBody: GeyserXuidResponse | null = null;
  try {
    xuidBody = (await xuidRes.json()) as GeyserXuidResponse;
  } catch {
    xuidBody = null;
  }

  if (!xuidBody?.xuid) throw new ProfileError(`No Bedrock player named "${name}".`);

  const xuid = xuidBody.xuid;

  // Step 2: XUID → skin (GeyserMC cache; empty if player hasn't joined a Floodgate server)
  let skinRes: Response;
  try {
    skinRes = await fetchImpl(`${GEYSER}/skin/${xuid}`);
  } catch {
    throw new ProfileError("Network error — check your connection and try again.");
  }

  let skinBody: GeyserSkinResponse | null = null;
  try {
    skinBody = (await skinRes.json()) as GeyserSkinResponse;
  } catch {
    skinBody = null;
  }

  if (!skinBody?.value) {
    throw new ProfileError(
      `"${name}" hasn't joined a GeyserMC server yet — their skin isn't available.`
    );
  }

  const { skinUrl, capeUrl } = decodeTexturesProperty(skinBody.value);

  return {
    playerId: String(xuid),
    username: name,
    // GeyserMC's is_steve flag is more reliable than the decoded metadata for Bedrock skins.
    slim: skinBody.is_steve === false,
    skinTextureUrl: skinUrl,
    capeTextureUrl: capeUrl,
  };
}

/**
 * Routes to the Java or Bedrock resolver based on `edition`.
 * `fetchImpl` defaults to the global `fetch`; pass a mock for tests.
 */
export async function resolveTextures(
  rawName: string,
  fetchImpl: typeof fetch = fetch,
  edition: Edition = "java"
): Promise<ResolvedTextures> {
  return edition === "bedrock"
    ? resolveBedrockTextures(rawName, fetchImpl)
    : resolveJavaTextures(rawName, fetchImpl);
}
