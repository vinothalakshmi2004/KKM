// Short two-tone chime made with Web Audio (no sound file to download).
// Browsers only allow audio after the user has interacted with the page, so the
// context is created/resumed on the first click or key press; before that the chime is skipped.
let ctx = null;

function unlock() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown'].forEach((evt) => window.addEventListener(evt, unlock, { passive: true }));
}

export function playNotificationSound() {
  try {
    if (!ctx || ctx.state !== 'running') return;
    const start = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // Sound is a nice-to-have; never break the page over it
  }
}
