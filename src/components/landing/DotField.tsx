import { useEffect, useRef } from 'react';

interface Props {
  className?: string;
  /** Distance between dots in CSS pixels. */
  spacing?: number;
  /** Draw the drifting "price line" of lit dots. */
  line?: boolean;
}

const ACCENT = [98, 185, 137];
const BASE = [147, 153, 149];

// A grid of dots that drifts like ink: the cursor pushes dots aside and they
// spring back, and a slowly moving line of brighter green dots traces a price
// path across the field. Purely decorative (aria-hidden), pauses when scrolled
// out of view, and draws a single still frame for people who ask for less motion.
export const DotField = ({ className, spacing = 16, line = true }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, cols = 0, rows = 0, dpr = 1;
    let ox: Float32Array, oy: Float32Array, vx: Float32Array, vy: Float32Array;
    const mouse = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let visible = true;
    const gap = window.innerWidth < 640 ? spacing + 6 : spacing;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
      const n = cols * rows;
      ox = new Float32Array(n); oy = new Float32Array(n);
      vx = new Float32Array(n); vy = new Float32Array(n);
    };

    // Height of the price line (0..1 of the canvas) at horizontal position x and time t.
    const lineY = (x: number, t: number) => {
      const u = x / Math.max(w, 1);
      return 0.58
        + 0.12 * Math.sin(u * 5.2 + t * 0.45)
        + 0.06 * Math.sin(u * 11.7 - t * 0.7)
        + 0.03 * Math.sin(u * 23 + t * 1.3)
        - 0.14 * u;
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          const bx = i * gap, by = j * gap;
          if (!reduce) {
            let fx = -ox[k] * 0.06, fy = -oy[k] * 0.06;
            if (mouse.active) {
              const dx = bx + ox[k] - mouse.x, dy = by + oy[k] - mouse.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 130 * 130) {
                const d = Math.sqrt(d2) || 1;
                const f = (1 - d / 130) * 3.2;
                fx += (dx / d) * f; fy += (dy / d) * f;
              }
            }
            vx[k] = (vx[k] + fx) * 0.86; vy[k] = (vy[k] + fy) * 0.86;
            ox[k] += vx[k]; oy[k] += vy[k];
          }
          const x = bx + ox[k], y = by + oy[k];
          let glow = 0;
          if (line) {
            const dy = (by / h - lineY(bx, reduce ? 0 : t)) * h;
            glow = Math.exp(-(dy * dy) / (2 * 34 * 34));
          }
          const lift = Math.min(1, Math.hypot(ox[k], oy[k]) / 14);
          const a = 0.3 + glow * 0.7 + lift * 0.3;
          const r = 1.15 + glow * 1.6 + lift * 0.7;
          const c = glow > 0.04 ? ACCENT : BASE;
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(a, 1).toFixed(3)})`;
          ctx.fillRect(x - r / 2, y - r / 2, r, r);
        }
      }
    };

    const loop = (time: number) => {
      if (visible) draw(time);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.active = mouse.y > -80 && mouse.y < r.height + 80;
    };
    const onLeave = () => { mouse.active = false; };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [spacing, line]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
};
