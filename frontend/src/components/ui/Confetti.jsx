import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#4285F4", "#EA4335", "#FBBC04", "#34A853", // Google colors
  "#FF6D00", "#AA00FF", "#00C853", "#2979FF", // Vibrant accents
];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function createParticle(canvas) {
  return {
    x: randomBetween(0, canvas.width),
    y: randomBetween(-canvas.height * 0.3, -10),
    w: randomBetween(6, 12),
    h: randomBetween(4, 8),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: randomBetween(0, 360),
    rotationSpeed: randomBetween(-6, 6),
    velocityX: randomBetween(-2, 2),
    velocityY: randomBetween(2, 6),
    wobble: randomBetween(0, Math.PI * 2),
    wobbleSpeed: randomBetween(0.03, 0.08),
    opacity: 1,
  };
}

export default function Confetti({ active = false, duration = 4000 }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    setVisible(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Create initial burst of particles
    const PARTICLE_COUNT = 150;
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas)
    );

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      particlesRef.current.forEach((p) => {
        // Update physics
        p.velocityY += 0.1; // gravity
        p.x += p.velocityX + Math.sin(p.wobble) * 0.5;
        p.y += p.velocityY;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;

        // Fade out in the last 30% of duration
        if (progress > 0.7) {
          p.opacity = Math.max(0, 1 - (progress - 0.7) / 0.3);
        }

        // Draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setVisible(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active, duration]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
