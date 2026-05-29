import { describe, it, expect, vi } from "vitest";
import { httpsify, fetchAsObjectURL } from "./textures";

describe("httpsify", () => {
  it("upgrades http:// to https://", () => {
    expect(httpsify("http://textures.minecraft.net/texture/abc")).toBe(
      "https://textures.minecraft.net/texture/abc"
    );
  });

  it("leaves https:// untouched", () => {
    expect(httpsify("https://textures.minecraft.net/x")).toBe(
      "https://textures.minecraft.net/x"
    );
  });

  it("only rewrites the leading scheme", () => {
    expect(httpsify("http://h/http://nope")).toBe("https://h/http://nope");
  });
});

describe("fetchAsObjectURL", () => {
  it("fetches the https URL and returns an object URL", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => blob } as Response);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:skin");

    const url = await fetchAsObjectURL(
      "http://textures.minecraft.net/texture/abc",
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://textures.minecraft.net/texture/abc"
    );
    expect(url).toBe("blob:skin");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchAsObjectURL("https://x", fetchImpl)).rejects.toThrow(
      /HTTP 503/
    );
  });
});
