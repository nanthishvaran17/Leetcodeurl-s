/**
 * confettiCelebration.ts — High-Performance Zero-Dependency Confetti Canvas Engine
 * ==============================================================================
 * Smooth 60 FPS physics particle burst for solves, milestones, and achievements.
 */

import { playCelebrationChime } from './audioChime';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  shape: 'rect' | 'circle' | 'strip';
}

const VIBRANT_COLORS = [
  '#10B981', // Emerald
  '#F59E0B', // Amber Gold
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#F43F5E'  // Rose
];

export function triggerConfetti(options?: {
  particleCount?: number;
  durationMs?: number;
  playSound?: boolean;
}): void {
  if (typeof window === 'undefined') return;

  const count = options?.particleCount || 160;
  const duration = options?.durationMs || 3200;
  if (options?.playSound !== false) {
    playCelebrationChime();
  }

  // Check if existing canvas is already animating
  const existingCanvas = document.getElementById('celebration-confetti-canvas');
  if (existingCanvas) {
    try {
      existingCanvas.remove();
    } catch {}
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'celebration-confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const particles: Particle[] = [];
  const shapes: Array<'rect' | 'circle' | 'strip'> = ['rect', 'circle', 'strip'];

  // Spawn dual bursts from bottom corners + top center shower
  for (let i = 0; i < count; i++) {
    const isLeft = i % 2 === 0;
    const startX = isLeft ? width * 0.15 : width * 0.85;
    const startY = height * 0.82;
    const angle = isLeft
      ? (Math.random() * 45 + 30) * (Math.PI / 180) // 30-75 deg
      : (Math.random() * 45 + 105) * (Math.PI / 180); // 105-150 deg
    const speed = Math.random() * 18 + 14;

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      size: Math.random() * 8 + 6,
      color: VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.random() * 0.1 + 0.05,
      opacity: 1,
      shape: shapes[Math.floor(Math.random() * shapes.length)]
    });
  }

  const startTime = performance.now();
  let animationFrameId: number;

  function render(now: number) {
    const elapsed = now - startTime;
    const progress = elapsed / duration;

    if (progress >= 1 || !ctx) {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      // Physics update
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45; // Gravity
      p.vx *= 0.985; // Air drag
      p.rotation += p.rotationSpeed;
      p.wobble += p.wobbleSpeed;

      // Fade out towards end
      if (progress > 0.65) {
        p.opacity = Math.max(0, 1 - (progress - 0.65) / 0.35);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      const scaleX = Math.cos(p.wobble);

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'strip') {
        ctx.scale(scaleX, 1);
        ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size, p.size * 3);
      } else {
        ctx.scale(scaleX, 1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  // Safety cleanup timeout
  setTimeout(() => {
    cancelAnimationFrame(animationFrameId);
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }, duration + 500);
}

/**
 * High-level celebratory trigger with celebration chime
 */
export function triggerCelebration(): void {
  triggerConfetti({ particleCount: 180, durationMs: 3400, playSound: true });
}
