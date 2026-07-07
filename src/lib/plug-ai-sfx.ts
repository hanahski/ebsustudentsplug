// Futuristic bass "whoosh" + reply chime for Plug AI, generated with WebAudio
// so we don't ship any binary assets. Cheap, respects reduced-motion & mute.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Deep sub-bass swoosh on user send. */
export function playPlugSend() {
  if (reducedMotion()) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const sub = a.createOscillator();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + 0.35);

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.35);

  sub.type = "sine";
  sub.frequency.setValueAtTime(80, t);
  sub.frequency.exponentialRampToValueAtTime(40, t + 0.35);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain).connect(a.destination);
  osc.start(t); sub.start(t);
  osc.stop(t + 0.42); sub.stop(t + 0.42);
}

/** Bright, warm two-note chime when Plug AI replies. */
export function playPlugReply() {
  if (reducedMotion()) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const notes = [660, 990];
  notes.forEach((freq, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t + i * 0.09);
    g.gain.setValueAtTime(0.0001, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.09 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.35);
    o.connect(g).connect(a.destination);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.38);
  });

  // sub thump under it
  const sub = a.createOscillator();
  const sg = a.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(90, t);
  sub.frequency.exponentialRampToValueAtTime(55, t + 0.25);
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  sub.connect(sg).connect(a.destination);
  sub.start(t); sub.stop(t + 0.32);
}
