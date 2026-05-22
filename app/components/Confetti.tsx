"use client";

import { useEffect, useRef } from "react";

const palette = ["#18845d", "#d94f76", "#3f6fb5", "#b27920", "#6f5bb5", "#1f8793", "#a94632", "#587443", "#e9b84a", "#cf5b46"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  drag: number;
  gravity: number;
  opacity: number;
  opacityDecay: number;
  shape: "rect" | "circle";
}

export function Confetti({ duration = 1500, particleCount = 120 }: { duration?: number; particleCount?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) return;

    const canvas = canvasEl;
    const ctx = ctx2d;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const particles: Particle[] = [];
    const originX = width / 2;
    const originY = height * 0.65;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * Math.PI) - (Math.PI / 2);
      const speed = 6 + Math.random() * 14;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (0.5 + Math.random() * 0.5),
        vy: -Math.abs(Math.sin(angle) * speed) - 4 - Math.random() * 6,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        drag: 0.96 + Math.random() * 0.02,
        gravity: 0.18 + Math.random() * 0.12,
        opacity: 1,
        opacityDecay: 0.004 + Math.random() * 0.006,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }

    let animationId: number;
    let startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.vx *= p.drag;
        p.vy += p.gravity;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.opacityDecay;

        if (p.opacity <= 0) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [duration, particleCount]);

  return <canvas ref={canvasRef} className="confettiCanvas" aria-hidden="true" />;
}
