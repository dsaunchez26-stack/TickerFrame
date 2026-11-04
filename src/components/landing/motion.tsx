import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Adds `is-in` to the element once it scrolls into view (one-way, so content
// never flickers back out).
export const useInView = <T extends HTMLElement>(threshold = 0.2) => {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
};

export const Reveal = ({ children, delay = 0, className = '', as: Tag = 'div' }: {
  children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'section' | 'p' | 'h2';
}) => {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      className={`lp-rv ${seen ? 'is-in' : ''} ${className}`}
      style={{ '--d': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
};

// Counts up to `to` the first time it is visible.
export const Counter = ({ to, prefix = '', suffix = '', duration = 1400 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) => {
  const [ref, seen] = useInView<HTMLSpanElement>(0.5);
  const [val, setVal] = useState(prefersReducedMotion() ? to : 0);
  useEffect(() => {
    if (!seen || prefersReducedMotion()) { if (seen) setVal(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return <span ref={ref} className="tabular-nums">{prefix}{val.toLocaleString()}{suffix}</span>;
};

// 0..1 progress of an element through the viewport, for scroll-linked drawing.
export const useScrollProgress = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [p, setP] = useState(prefersReducedMotion() ? 1 : 0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setP(Math.max(0, Math.min(1, (vh * 0.7 - r.top) / (r.height + vh * 0.2))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return [ref, p] as const;
};
