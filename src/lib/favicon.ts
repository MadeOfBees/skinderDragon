// Persists the last looked-up player and drives the browser tab favicon.
//
// On a successful search we render the player's head (see `renderHead`) and use
// it as the favicon, remembering it in localStorage so the next visit opens with
// that player's face already in the tab. With nothing stored, the static Steve
// face from `public/favicon.png` (declared in index.html, downloaded by `npm run assets:ensure`) shows by default.

const KEY_NAME = "skinderdragon:lastUsername";
const KEY_HEAD = "skinderdragon:lastHead";

export interface LastSearch {
  username: string;
  /** Data URL of the rendered player head. */
  head: string;
}

/** Points the tab favicon at the given URL (data URL or path). */
export function setFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = href;
}

/** Reads the last-searched player from localStorage, or `null`. */
export function loadLastSearch(): LastSearch | null {
  try {
    const username = localStorage.getItem(KEY_NAME);
    const head = localStorage.getItem(KEY_HEAD);
    return username && head ? { username, head } : null;
  } catch {
    return null; // storage disabled (private mode) — degrade silently
  }
}

/** Remembers the last-searched player and updates the favicon to their head. */
export function rememberLastSearch(username: string, head: string): void {
  try {
    localStorage.setItem(KEY_NAME, username);
    localStorage.setItem(KEY_HEAD, head);
  } catch {
    /* best-effort */
  }
  setFavicon(head);
}
