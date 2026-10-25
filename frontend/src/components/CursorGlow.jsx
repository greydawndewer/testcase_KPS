import { useEffect, useRef } from 'react';

const CANVAS_SIZE = 240;
const MAX_SPARKLES = 24;
const SPACING = 15;
const SPARKLE_LIFETIME = 190;

const CursorGlow = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!canvas || !context || !finePointer.matches || reducedMotion.matches) return undefined;

    const sparkles = [];
    let frameId = null;
    let pointer = null;
    let previousPointer = null;
    let spacingRemainder = 0;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const addSparkle = (x, y, now) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 18;
      sparkles.push({
        x,
        y,
        driftX: Math.cos(angle) * speed,
        driftY: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI,
        size: 2 + Math.random() * 2.5,
        createdAt: now,
      });
      if (sparkles.length > MAX_SPARKLES) sparkles.shift();
    };

    const drawSparkle = (sparkle, x, y, opacity) => {
      context.save();
      context.translate(x, y);
      context.rotate(sparkle.rotation);
      context.globalAlpha = opacity;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.moveTo(0, -sparkle.size);
      context.lineTo(sparkle.size * 0.2, -sparkle.size * 0.2);
      context.lineTo(sparkle.size, 0);
      context.lineTo(sparkle.size * 0.2, sparkle.size * 0.2);
      context.lineTo(0, sparkle.size);
      context.lineTo(-sparkle.size * 0.2, sparkle.size * 0.2);
      context.lineTo(-sparkle.size, 0);
      context.lineTo(-sparkle.size * 0.2, -sparkle.size * 0.2);
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawFrame = () => {
      frameId = null;
      if (!pointer) return;

      const now = performance.now();
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      let aliveCount = 0;
      for (const sparkle of sparkles) {
        const age = now - sparkle.createdAt;
        if (age >= SPARKLE_LIFETIME) continue;
        const seconds = age / 1000;
        drawSparkle(
          sparkle,
          sparkle.x - pointer.x + CANVAS_SIZE / 2 + sparkle.driftX * seconds,
          sparkle.y - pointer.y + CANVAS_SIZE / 2 + sparkle.driftY * seconds,
          1 - age / SPARKLE_LIFETIME,
        );
        sparkles[aliveCount] = sparkle;
        aliveCount += 1;
      }
      sparkles.length = aliveCount;

      if (sparkles.length > 0) {
        frameId = window.requestAnimationFrame(drawFrame);
      }
    };

    const scheduleFrame = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(drawFrame);
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch') return;

      const now = performance.now();
      const current = { x: event.clientX, y: event.clientY };
      pointer = current;
      canvas.style.transform = `translate3d(${current.x - CANVAS_SIZE / 2}px, ${current.y - CANVAS_SIZE / 2}px, 0)`;

      if (!previousPointer) {
        addSparkle(current.x, current.y, now);
      } else {
        const dx = current.x - previousPointer.x;
        const dy = current.y - previousPointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0) {
          let distanceToNext = SPACING - spacingRemainder;
          while (distanceToNext <= distance) {
            const progress = distanceToNext / distance;
            addSparkle(
              previousPointer.x + dx * progress,
              previousPointer.y + dy * progress,
              now,
            );
            distanceToNext += SPACING;
          }
          spacingRemainder = (spacingRemainder + distance) % SPACING;
        }
      }

      previousPointer = current;
      if (sparkles.length > 0) scheduleFrame();
    };

    const handlePointerLeave = () => {
      previousPointer = null;
      spacingRemainder = 0;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        sparkles.length = 0;
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="cursor-sparks" />;
};

export default CursorGlow;
