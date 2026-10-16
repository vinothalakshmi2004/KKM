import { useEffect, useRef } from 'react';

/**
 * Animated background: glowing gold points drift slowly and link up with thin gold lines when
 * they come close, like nerves firing. Small pulses travel along some links. Canvas only, no
 * library. Honours "reduce motion" (draws one still frame) and pauses when the tab is hidden.
 */
export default function GoldNerves({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const GOLD = '201, 164, 92';
    const LIGHT = '227, 203, 147';
    let w = 0;
    let h = 0;
    let dpr = 1;
    let nodes = [];
    let pulses = [];
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with the screen: fewer points on phones
      const count = Math.max(28, Math.min(90, Math.round((w * h) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      }));
      pulses = [];
    };

    const LINK = () => Math.max(110, Math.min(170, w / 9));

    const frame = (now) => {
      const dt = Math.min(48, now - last) / 16.7;
      last = now;
      ctx.clearRect(0, 0, w, h);
      const link = LINK();

      // Move
      if (!reduce) {
        for (const n of nodes) {
          n.x += n.vx * dt;
          n.y += n.vy * dt;
          if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
          n.phase += 0.02 * dt;
        }
      }

      // Links (the "nerves")
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes.at(i);
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes.at(j);
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < link) {
            const alpha = (1 - d / link) * 0.7;
            ctx.strokeStyle = `rgba(${GOLD}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            // Occasionally fire a pulse along a short link
            if (!reduce && d < link * 0.7 && pulses.length < 14 && Math.random() < 0.0009 * dt) {
              pulses.push({ a, b, t: 0, speed: 0.012 + Math.random() * 0.012 });
            }
          }
        }
      }

      // Pulses travelling along links
      pulses = pulses.filter((p) => p.t <= 1);
      for (const p of pulses) {
        p.t += p.speed * dt;
        const x = p.a.x + (p.b.x - p.a.x) * p.t;
        const y = p.a.y + (p.b.y - p.a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, `rgba(${LIGHT}, 0.95)`);
        g.addColorStop(1, `rgba(${GOLD}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Points, gently breathing
      for (const n of nodes) {
        const glow = 0.55 + 0.45 * Math.sin(n.phase);
        ctx.fillStyle = `rgba(${LIGHT}, ${0.35 + 0.5 * glow})`;
        ctx.shadowColor = `rgba(${GOLD}, 0.9)`;
        ctx.shadowBlur = 8 * glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
