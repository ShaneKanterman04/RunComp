"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(target: number, duration = 800, decimals = 2) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || duration <= 0) {
      setDisplay(target);
      return;
    }

    fromRef.current = display;
    startRef.current = null;

    function animate(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display.toFixed(decimals);
}

export function AnimatedMiles({ value, className }: { value: number; className?: string }) {
  const animated = useAnimatedNumber(value, 800, 2);
  return (
    <span className={className} data-testid="animated-miles">
      {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(animated))} mi
    </span>
  );
}
