import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { httpsify, toMojangTextureUrl, fetchAsObjectURL } from "./textures";

function textureResponse(blob: Blob, init: { status?: number; headers?: HeadersInit } = {}) {
  return {
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    blob: async () => blob,
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 64, height: 64, close: vi.fn() })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe("toMojangTextureUrl", () => {
  it("normalizes official texture URLs to https", () => {
    expect(toMojangTextureUrl("http://textures.minecraft.net/texture/abc123")).toBe(
      "https://textures.minecraft.net/texture/abc123"
    );
  });

  it("rejects non-Mojang texture hosts", () => {
    expect(() => toMojangTextureUrl("https://example.com/texture/abc123")).toThrow(
      /Mojang/
    );
  });

  it("rejects URLs with extra authority or path parts", () => {
    expect(() =>
      toMojangTextureUrl("https://user@textures.minecraft.net/texture/abc123")
    ).toThrow(/Mojang/);
    expect(() =>
      toMojangTextureUrl("https://textures.minecraft.net/texture/abc123?x=1")
    ).toThrow(/Mojang/);
    expect(() =>
      toMojangTextureUrl("https://textures.minecraft.net/profile/abc123")
    ).toThrow(/Mojang/);
  });
});

describe("fetchAsObjectURL", () => {
  it("fetches the https URL and returns an object URL", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImpl = vi.fn().mockResolvedValue(textureResponse(blob));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:skin");

    const url = await fetchAsObjectURL(
      "http://textures.minecraft.net/texture/abc",
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://textures.minecraft.net/texture/abc",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(url).toBe("blob:skin");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(textureResponse(new Blob(["png"], { type: "image/png" }), { status: 503 }));
    await expect(
      fetchAsObjectURL("https://textures.minecraft.net/texture/abc", fetchImpl)
    ).rejects.toThrow(
      /HTTP 503/
    );
  });

  it("rejects non-Mojang URLs before fetching", async () => {
    const fetchImpl = vi.fn();

    await expect(fetchAsObjectURL("https://example.com/skin.png", fetchImpl)).rejects.toThrow(
      /Mojang/
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects oversized texture responses before reading the blob", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImpl = vi.fn().mockResolvedValue(
      textureResponse(blob, {
        headers: { "content-length": String(1_048_577), "content-type": "image/png" },
      })
    );

    await expect(
      fetchAsObjectURL("https://textures.minecraft.net/texture/abc", fetchImpl)
    ).rejects.toThrow(/too large/);
  });

  it("rejects non-texture response types", async () => {
    const blob = new Blob(["html"], { type: "text/html" });
    const fetchImpl = vi.fn().mockResolvedValue(textureResponse(blob));

    await expect(
      fetchAsObjectURL("https://textures.minecraft.net/texture/abc", fetchImpl)
    ).rejects.toThrow(/texture image/);
  });

  it("allows Mojang texture binary content types when dimensions are valid", async () => {
    const blob = new Blob(["png"], { type: "binary/octet-stream" });
    const fetchImpl = vi.fn().mockResolvedValue(
      textureResponse(blob, { headers: { "content-type": "binary/octet-stream" } })
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cape");

    await expect(
      fetchAsObjectURL("https://textures.minecraft.net/texture/c0ffee", fetchImpl)
    ).resolves.toBe("blob:cape");
  });

  it("rejects decoded dimensions outside Minecraft texture bounds", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 2048, height: 2048, close: vi.fn() })
    );
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImpl = vi.fn().mockResolvedValue(textureResponse(blob));

    await expect(
      fetchAsObjectURL("https://textures.minecraft.net/texture/abc", fetchImpl)
    ).rejects.toThrow(/dimensions/);
  });
});
