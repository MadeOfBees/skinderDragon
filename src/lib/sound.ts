// A tiny WebAudio approximation of Minecraft's UI click (ui.button.click).
// Synthesized so there's no audio asset and nothing autoplays — it only fires
// on a real user gesture (a button press), which also satisfies autoplay rules.

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(value: boolean) {
  muted = value;
}

/** Short, dry, wood-ish click. */
export function playClick(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.05);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch {
    /* audio is best-effort */
  }
}

/** A brighter two-note chime for the "advancement" toast. */
export function playChime(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const t = ac.currentTime;
    [988, 1319].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(0.0001, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.22);
      osc.connect(gain).connect(ac.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.24);
    });
  } catch {
    /* best-effort */
  }
}
