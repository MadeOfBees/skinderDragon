import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

// skinview3d needs WebGL, which jsdom lacks — stub it with inert classes.
vi.mock("skinview3d", () => {
  class SkinViewer {
    controls = { enablePan: true };
    playerObject = { rotation: { y: 0, z: 0 } };
    autoRotate = false;
    animation: unknown = null;
    nameTag: unknown = null;
    loadSkin = vi.fn().mockResolvedValue(undefined);
    loadCape = vi.fn().mockResolvedValue(undefined);
    dispose = vi.fn();
    constructor(_opts: unknown) {}
  }
  class Anim {
    headBobbing = true;
    progress = 0;
    paused = false;
    update = vi.fn();
    constructor(..._args: unknown[]) {}
  }
  return {
    SkinViewer,
    WalkingAnimation: Anim,
    WaveAnimation: Anim,
    CrouchAnimation: Anim,
    FlyingAnimation: Anim,
    NameTagObject: class {
      constructor(..._args: unknown[]) {}
    },
  };
});

vi.mock("./lib/profile", () => ({
  ProfileError: class ProfileError extends Error {},
  fetchProfile: vi.fn(),
}));

vi.mock("./lib/exportGif", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/exportGif")>();
  return { ...actual, generateGif: vi.fn() };
});

import { App } from "./App";
import { fetchProfile, ProfileError } from "./lib/profile";
import { generateGif } from "./lib/exportGif";

const profile = {
  uuid: "u",
  username: "EthosLab",
  slim: false,
  skinUrl: "blob:skin",
  capeUrl: null as string | null,
};

async function loadUser(name: string) {
  await userEvent.type(screen.getByPlaceholderText(/username/i), name);
  await userEvent.click(screen.getByRole("button", { name: /load skin/i }));
}

beforeEach(() => {
  vi.mocked(fetchProfile).mockReset();
  vi.mocked(generateGif).mockReset();
});

describe("<App>", () => {
  it("renders the title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /skinderdragon/i })
    ).toBeInTheDocument();
  });

  it("loads a skin and shows the player without a cape badge", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    render(<App />);
    await loadUser("EthosLab");

    expect(fetchProfile).toHaveBeenCalledWith("EthosLab");
    expect(await screen.findByText("EthosLab")).toBeInTheDocument();
    expect(screen.queryByTestId("cape-badge")).not.toBeInTheDocument();
  });

  it("shows a cape badge when the player has a cape", async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      ...profile,
      username: "jeb_",
      capeUrl: "blob:cape",
    });
    render(<App />);
    await loadUser("jeb_");

    expect(await screen.findByText("jeb_")).toBeInTheDocument();
    expect(screen.getByTestId("cape-badge")).toBeInTheDocument();
  });

  it("surfaces a friendly error for unknown players", async () => {
    vi.mocked(fetchProfile).mockRejectedValue(
      new ProfileError("No Minecraft player named “ghost”.")
    );
    render(<App />);
    await loadUser("ghost");

    expect(await screen.findByText(/no minecraft player/i)).toBeInTheDocument();
  });

  it("generates a run GIF and offers a correctly-named download", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(generateGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    await userEvent.click(screen.getByRole("button", { name: /generate gif/i }));

    const link = await screen.findByRole("link", { name: /download gif/i });
    expect(link).toHaveAttribute("download", "EthosLab-run.gif");
    expect(generateGif).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "run",
        skinUrl: "blob:skin",
        background: { kind: "color", color: "#1d2030" },
      })
    );
  });

  it("honors the orbit + transparent selections", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(generateGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    await userEvent.click(screen.getByRole("button", { name: /orbit/i }));
    await userEvent.click(screen.getByRole("button", { name: /transparent/i }));
    await userEvent.click(screen.getByRole("button", { name: /generate gif/i }));

    expect(generateGif).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "orbit", background: { kind: "transparent" } })
    );
    const link = await screen.findByRole("link", { name: /download/i });
    expect(link).toHaveAttribute("download", "EthosLab-orbit.gif");
  });

  it("shows the color picker only for the solid background", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    expect(screen.getByText("#1d2030")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /transparent/i }));
    expect(screen.queryByText("#1d2030")).not.toBeInTheDocument();
  });
});
