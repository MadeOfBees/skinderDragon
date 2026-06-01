import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

// skinview3d needs WebGL, which jsdom lacks — stub it with inert classes.
vi.mock("skinview3d", () => {
  class SkinViewer {
    controls = { enablePan: true };
    playerObject = { rotation: { y: 0, z: 0 } };
    playerWrapper = { rotation: { y: 0, z: 0 } };
    scene = { add: vi.fn(), remove: vi.fn() };
    animation: unknown = null;
    loadSkin = vi.fn().mockResolvedValue(undefined);
    loadCape = vi.fn().mockResolvedValue(undefined);
    dispose = vi.fn();
    constructor(_opts: unknown) {}
  }
  class Anim {
    progress = 0;
    paused = false;
    update = vi.fn();
    constructor(..._args: unknown[]) {}
  }
  class FunctionAnimation extends Anim {
    fn: unknown;
    constructor(fn: unknown) {
      super();
      this.fn = fn;
    }
  }
  return {
    SkinViewer,
    FunctionAnimation,
    RunningAnimation: Anim,
    CrouchAnimation: Anim,
    FlyingAnimation: Anim,
    NameTagObject: class {
      position = { y: 0 };
      painted = Promise.resolve();
      constructor(..._args: unknown[]) {}
    },
  };
});

vi.mock("./lib/profile", () => ({
  ProfileError: class ProfileError extends Error {},
  fetchProfile: vi.fn(),
}));

// The preview hook captures the GIF straight from the live viewer via
// captureViewerGif; stub that out (no real WebGL in jsdom).
vi.mock("./lib/exportGif", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/exportGif")>();
  return { ...actual, captureViewerGif: vi.fn() };
});

import { App } from "./App";
import { fetchProfile, ProfileError } from "./lib/profile";
import { captureViewerGif } from "./lib/exportGif";

const profile = {
  playerId: "u",
  username: "EthosLab",
  slim: false,
  skinUrl: "blob:skin",
  capeUrl: null as string | null,
};

async function loadUser(name: string) {
  await userEvent.type(screen.getByPlaceholderText(/username/i), name);
  await userEvent.click(screen.getByRole("button", { name: /search/i }));
}

async function waitForPreviewReady() {
  const button = await screen.findByRole("button", { name: /generate gif/i });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

beforeEach(() => {
  vi.mocked(fetchProfile).mockReset();
  vi.mocked(captureViewerGif).mockReset();
  localStorage.clear(); // keep persisted settings (e.g. panorama) from leaking
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

    expect(fetchProfile).toHaveBeenCalledWith("EthosLab", "java");
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
    vi.mocked(captureViewerGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    await userEvent.click(await waitForPreviewReady());

    const link = await screen.findByRole("link", { name: /download gif/i });
    expect(link).toHaveAttribute("download", "EthosLab-run.gif");
    expect(captureViewerGif).toHaveBeenCalledWith(
      expect.anything(), // the live preview viewer
      expect.anything(), // its current ModeAnimation
      expect.objectContaining({
        orbit: false,
        background: { kind: "color", color: "#1d2030" },
      })
    );
  });

  it("lets an in-progress GIF render be cancelled", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    let signal: AbortSignal | undefined;
    vi.mocked(captureViewerGif).mockImplementation(
      (_viewer, _modeAnim, opts) =>
        new Promise((_, reject) => {
          signal = opts.signal;
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"));
          });
        })
    );
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    await userEvent.click(await waitForPreviewReady());
    await userEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByTestId("gif-modal")).not.toBeInTheDocument());
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(/failed to generate/i)).not.toBeInTheDocument();
  });

  it("layers the orbit toggle onto a mode and honors transparency", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(captureViewerGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    // Orbit is a modifier: the mode stays "run" but orbit flips on.
    await userEvent.click(screen.getByRole("checkbox", { name: /orbit/i }));
    await userEvent.click(screen.getByRole("button", { name: /transparent/i }));
    await userEvent.click(await waitForPreviewReady());

    expect(captureViewerGif).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        orbit: true,
        background: { kind: "transparent" },
      })
    );
    const link = await screen.findByRole("link", { name: /download/i });
    expect(link).toHaveAttribute("download", "EthosLab-run-orbit.gif");
  });

  it("picks a mode from the buttons and names the download for it", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(captureViewerGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    // Slider index 0 = sneak (Crouch), 1 = run, 2 = fly
    fireEvent.change(screen.getByRole("slider", { name: /animation mode/i }), { target: { value: "0" } });
    await userEvent.click(await waitForPreviewReady());

    const link = await screen.findByRole("link", { name: /download gif/i });
    expect(link).toHaveAttribute("download", "EthosLab-sneak.gif");
  });

  it("toggles the nametag and still generates from the live viewer", async () => {
    vi.mocked(fetchProfile).mockResolvedValue(profile);
    vi.mocked(captureViewerGif).mockResolvedValue(new Blob(["gif"], { type: "image/gif" }));
    render(<App />);
    await loadUser("EthosLab");
    await screen.findByText("EthosLab");

    // Off by default; one click turns it on. The nametag now lives on the live
    // viewer (WYSIWYG), so it's not a capture argument — just confirm the toggle
    // sticks and a GIF is still produced.
    const nametag = screen.getByRole("checkbox", { name: /nametag/i });
    await userEvent.click(nametag);
    expect(nametag).toBeChecked();

    await userEvent.click(await waitForPreviewReady());
    expect(await screen.findByRole("link", { name: /download gif/i })).toBeInTheDocument();
    expect(captureViewerGif).toHaveBeenCalled();
  });

  it("opens settings and switches the panorama source", async () => {
    render(<App />);
    expect(screen.queryByTestId("settings")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("open-settings"));
    expect(await screen.findByTestId("settings")).toBeInTheDocument();
    // Release is the default selection.
    expect(screen.getByTestId("panorama-release")).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByTestId("panorama-snapshot"));
    expect(screen.getByTestId("panorama-snapshot")).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("skinderdragon:panoramaSource")).toBe("snapshot");

    await userEvent.click(screen.getByTestId("edition-bedrock"));
    expect(screen.getByText(/bedrock skins are best-effort/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.queryByTestId("settings")).not.toBeInTheDocument();
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
