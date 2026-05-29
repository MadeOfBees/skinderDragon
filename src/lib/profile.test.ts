import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./providers", () => ({
  ProfileError: class ProfileError extends Error {},
  resolveTextures: vi.fn(),
}));
vi.mock("./textures", () => ({
  fetchAsObjectURL: vi.fn(),
}));

import { fetchProfile } from "./profile";
import { resolveTextures } from "./providers";
import { fetchAsObjectURL } from "./textures";

const resolved = {
  uuid: "u",
  username: "Notch",
  slim: true,
  skinTextureUrl: "https://textures.minecraft.net/texture/skin",
  capeTextureUrl: "https://textures.minecraft.net/texture/cape",
};

beforeEach(() => {
  vi.mocked(resolveTextures).mockReset();
  vi.mocked(fetchAsObjectURL).mockReset();
});

describe("fetchProfile", () => {
  it("returns object URLs for skin and cape", async () => {
    vi.mocked(resolveTextures).mockResolvedValue(resolved);
    vi.mocked(fetchAsObjectURL)
      .mockResolvedValueOnce("blob:skin")
      .mockResolvedValueOnce("blob:cape");

    const profile = await fetchProfile("Notch");

    expect(profile).toEqual({
      uuid: "u",
      username: "Notch",
      slim: true,
      skinUrl: "blob:skin",
      capeUrl: "blob:cape",
    });
    expect(fetchAsObjectURL).toHaveBeenNthCalledWith(1, resolved.skinTextureUrl);
    expect(fetchAsObjectURL).toHaveBeenNthCalledWith(2, resolved.capeTextureUrl);
  });

  it("leaves capeUrl null when there is no cape", async () => {
    vi.mocked(resolveTextures).mockResolvedValue({ ...resolved, capeTextureUrl: null });
    vi.mocked(fetchAsObjectURL).mockResolvedValueOnce("blob:skin");

    const profile = await fetchProfile("Notch");

    expect(profile.capeUrl).toBeNull();
    expect(fetchAsObjectURL).toHaveBeenCalledTimes(1);
  });

  it("treats a failed cape download as non-fatal", async () => {
    vi.mocked(resolveTextures).mockResolvedValue(resolved);
    vi.mocked(fetchAsObjectURL)
      .mockResolvedValueOnce("blob:skin")
      .mockRejectedValueOnce(new Error("cape 404"));

    const profile = await fetchProfile("Notch");

    expect(profile.skinUrl).toBe("blob:skin");
    expect(profile.capeUrl).toBeNull();
  });
});
