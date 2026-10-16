import { useEffect, useRef } from 'react';

/**
 * variant="dark" (navy sections): soft golden bubbles. variant="light" (white / cream sections):
 * very light, see-through navy bubbles that never compete with the text.
 *
 * Animated background: soft golden bubbles of different sizes float slowly upwards, sway a
 * little and fade in and out. Canvas only, no library. Honours "reduce motion" (one still frame)
 * and pauses when the tab is hidden or the section is scrolled out of view. `soft` = fainter and
 * fewer, for sections with text-heavy cards (amenities, footer).
 */
export default function GoldBubbles({ className = '', variant = 'dark', soft = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const light = variant === 'light';
    let w = 0;
    let h = 0;
    let bubbles = [];
    let raf = 0;
    let running = true;
    let visible = true;
    let last = performance.now();

    const make = (anywhere) => {
      const r = 3 + Math.random() ** 2.2 * 34; // mostly small, a few large
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + r + Math.random() * 60,
        r,
        speed: 0.15 + (1 - r / 40) * 0.45 + Math.random() * 0.2, // small ones rise faster
        sway: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        alpha: (light ? 0.1 + Math.random() * 0.16 : 0.18 + Math.random() * 0.4) * (soft ? 0.85 : 1),
        // light gold / gold; the softer navy sections use richer gold so faint bubbles still read as gold
        hue: soft ? (Math.random() < 0.5 ? '214, 182, 118' : '201, 164, 92') : Math.random() < 0.6 ? '227, 203, 147' : '201, 164, 92',
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = soft ? Math.max(10, Math.min(30, Math.round((w * h) / 48000))) : light ? Math.max(10, Math.min(34, Math.round((w * h) / 42000))) : Math.max(18, Math.min(60, Math.round((w * h) / 26000)));
      bubbles = Array.from({ length: count }, () => make(true));
    };

    const draw = (b) => {
      // Fade near the top so bubbles dissolve rather than pop out of view
      const fade = Math.max(0, Math.min(1, b.y / (h * 0.35)));
      const a = b.alpha * fade;
      if (a <= 0.01) return;
      if (light) {
        // White / cream sections: navy bubbles, very light and see-through
        const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(26, 38, 64, ${a * 0.32})`);
        g.addColorStop(0.7, `rgba(17, 27, 48, ${a * 0.14})`);
        g.addColorStop(1, 'rgba(11, 19, 36, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(26, 38, 64, ${a * 0.45})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.hue}, ${a * 0.9})`);
      g.addColorStop(0.65, `rgba(${b.hue}, ${a * 0.35})`);
      g.addColorStop(1, `rgba(${b.hue}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      // Thin rim on the bigger bubbles
      if (b.r > (soft ? 7 : 12)) {
        ctx.strokeStyle = `rgba(227, 203, 147, ${a * (soft ? 0.7 : 0.45)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const frame = (now) => {
      const dt = Math.min(48, now - last) / 16.7;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < bubbles.length; i += 1) {
        const b = bubbles.at(i);
        if (!reduce) {
          b.phase += 0.012 * dt;
          b.y -= b.speed * dt;
          b.x += Math.sin(b.phase) * 0.25 * b.sway * dt;
          if (b.y < -b.r - 10) bubbles.splice(i, 1, make(false));
        }
        draw(b);
      }
      if (!reduce && running && visible) raf = requestAnimationFrame(frame);
    };

    const restart = () => {
      cancelAnimationFrame(raf);
      if (!reduce && running && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const onVisibility = () => { running = !document.hidden; restart(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; restart(); });

    resize();
    raf = requestAnimationFrame(frame);
    io.observe(canvas);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [variant, soft]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
