// Minecraft-style splash lines (yellow, bouncing). Picked at random on load.
export const SPLASHES = [
  "Now with capes!",
  "100% client-side!",
  "Spinning blocks since 2026!",
  "render-distance: 1 player",
  "It's pronounced skin-der-dragon!",
  "Made with redstone!",
  "Don't dig straight down!",
  "Cape not included*",
  "Punch a tree, get a GIF!"
];

export function randomSplash(): string {
  return SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
}
