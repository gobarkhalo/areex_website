import React, { useEffect, useRef } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [data-plan-card]';

/**
 * Lightweight custom cursor.
 * - Single requestAnimationFrame loop, transform-only (GPU composited)
 * - No React re-renders on mouse move (hover state is toggled via a class)
 * - No CSS transitions on the moving transform (those caused the lag/jitter)
 */
export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!finePointer || navigator.webdriver === true) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add('has-custom-cursor');

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let hovered = false;
    let visible = false;
    let raf = 0;

    const render = () => {
      // Dot follows instantly, ring eases toward the pointer
      ringX += (targetX - ringX) * 0.22;
      ringY += (targetY - ringY) * 0.22;
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      const settled = Math.abs(targetX - ringX) < 0.1 && Math.abs(targetY - ringY) < 0.1;
      raf = settled ? 0 : requestAnimationFrame(render);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      const o = v ? '1' : '0';
      dot.style.opacity = o;
      ring.style.opacity = o;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!visible) {
        ringX = e.clientX;
        ringY = e.clientY;
        setVisible(true);
      }
      targetX = e.clientX;
      targetY = e.clientY;
      kick();
    };

    const onOver = (e: MouseEvent) => {
      const isInteractive = Boolean((e.target as HTMLElement | null)?.closest?.(INTERACTIVE));
      if (isInteractive === hovered) return;
      hovered = isInteractive;
      dot.classList.toggle('is-hover', hovered);
      ring.classList.toggle('is-hover', hovered);
    };

    const onLeave = () => setVisible(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="areex-cursor-layer">
      <div ref={ringRef} className="areex-cursor-ring" />
      <div ref={dotRef} className="areex-cursor-dot" />
    </div>
  );
};
