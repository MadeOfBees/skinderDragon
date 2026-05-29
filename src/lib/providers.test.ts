import { describe, it, expect, vi } from "vitest";
import {
  resolveTextures,
  decodeTexturesProperty,
  ProfileError,
} from "./providers";

const SKIN_URL = "http://textures.minecraft.net/texture/skinhash";
const CAPE_URL = "http://textures.minecraft.net/texture/capehash";

function texturesValue(opts: { slim?: boolean; cape?: boolean } = {}): string {
  const textures: Record<string, unknown> = {
    SKIN: {
      url: SKIN_URL,
      ...(opts.slim ? { metadata: { model: "slim" } } : {}),
    },
  };
  if (opts.cape) textures.CAPE = { url: CAPE_URL };
  return btoa(JSON.stringify({ textures }));
}

function playerdbOk(opts: { slim?: boolean; cape?: boolean } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      code: "player.found",
      message: "",
      data: {
        player: {
          id: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
          raw_id: "069a79f444e94726a5befca90e38aaf5",
          username: "Notch",
          properties: [{ name: "textures", value: texturesValue(opts) }],
        },
      },
    }),
  } as unknown as Response;
}

describe("decodeTexturesProperty", () => {
  it("decodes a classic skin without a cape", () => {
    const r = decodeTexturesProperty(texturesValue());
    expect(r).toEqual({ skinUrl: SKIN_URL, capeUrl: null, slim: false });
  });

  it("decodes a slim skin with a cape", () => {
    const r = decodeTexturesProperty(texturesValue({ slim: true, cape: true }));
    expect(r).toEqual({ skinUrl: SKIN_URL, capeUrl: CAPE_URL, slim: true });
  });

  it("rejects unreadable base64", () => {
    expect(() => decodeTexturesProperty("@@@not base64@@@")).toThrow(ProfileError);
  });

  it("rejects a payload with no skin", () => {
    expect(() => decodeTexturesProperty(btoa(JSON.stringify({ textures: {} })))).toThrow(
      /no skin/i
    );
  });
});

describe("resolveTextures validation", () => {
  it("rejects an empty username", async () => {
    await expect(resolveTextures("   ", vi.fn())).rejects.toThrow(/enter a username/i);
  });

  it("rejects illegal characters", async () => {
    await expect(resolveTextures("bad name!", vi.fn())).rejects.toThrow(/1.16 characters/);
  });

  it("rejects an overlong username", async () => {
    await expect(resolveTextures("a".repeat(17), vi.fn())).rejects.toThrow(ProfileError);
  });
});

describe("resolveTextures lookup", () => {
  it("resolves a known player to official texture URLs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(playerdbOk({ cape: true }));
    const r = await resolveTextures("Notch", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://playerdb.co/api/player/minecraft/Notch"
    );
    expect(r).toEqual({
      uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      username: "Notch",
      slim: false,
      skinTextureUrl: SKIN_URL,
      capeTextureUrl: CAPE_URL,
    });
  });

  it("returns null cape when the player has none", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(playerdbOk());
    const r = await resolveTextures("Notch", fetchImpl);
    expect(r.capeTextureUrl).toBeNull();
  });

  it("maps a 400 / success:false to a friendly not-found error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, code: "minecraft.invalid_username" }),
    } as unknown as Response);
    await expect(resolveTextures("ghost", fetchImpl)).rejects.toThrow(
      /no minecraft player/i
    );
  });

  it("maps a network failure to a friendly error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(resolveTextures("Notch", fetchImpl)).rejects.toThrow(/network error/i);
  });

  it("errors when the textures property is missing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { player: { id: "x", raw_id: "x", username: "Notch", properties: [] } },
      }),
    } as unknown as Response);
    await expect(resolveTextures("Notch", fetchImpl)).rejects.toThrow(/no skin data/i);
  });
});
