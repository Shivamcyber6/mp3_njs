'use client';

import { useEffect, useRef } from 'react';
import { usePlayer } from '@/lib/player';

/** Frequency bars drawn from the live audio. Falls back to still bars before the first play. */
export function Visualizer({ className, bars = 48 }: { className?: string; bars?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { getAnalyser, isPlaying } = usePlayer();

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let level = new Float32Array(bars);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff7a45';
    const line = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#2a2a33';

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      // Hidden (e.g. the desktop panel on a phone): nothing to draw, check again next frame.
      if (w < bars * 4 || h < 4) {
        if (!reduced) raf = requestAnimationFrame(draw);
        return;
      }
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const analyser = getAnalyser();
      const target = new Float32Array(bars);
      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        // Log-ish spread so bass doesn't take every bar.
        for (let i = 0; i < bars; i++) {
          const from = Math.floor(Math.pow(i / bars, 1.6) * data.length * 0.85);
          const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / bars, 1.6) * data.length * 0.85));
          let sum = 0;
          for (let j = from; j < to; j++) sum += data[j];
          target[i] = sum / (to - from) / 255;
        }
      }
      for (let i = 0; i < bars; i++) level[i] += (target[i] - level[i]) * 0.35;

      const gap = 3;
      const bw = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        const v = Math.max(0.04, level[i]);
        const bh = Math.max(3, v * h);
        ctx.fillStyle = level[i] > 0.05 ? accent : line;
        ctx.globalAlpha = 0.35 + v * 0.65;
        const x = i * (bw + gap);
        ctx.beginPath();
        ctx.roundRect(x, h - bh, bw, bh, Math.max(0, Math.min(3, bw / 2)));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      level = new Float32Array(bars);
    };
  }, [getAnalyser, isPlaying, bars]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
