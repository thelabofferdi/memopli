import React, { useEffect, useRef } from "react";

// Trame de points (dithering ordonné) dessinée sur un canvas.
// Adapté de « mesa » par LN (github.com/ln-dev7/landing-pages), licence MIT.
// La trame dérive lentement quand elle est visible et reste fixe si
// l'utilisateur préfère réduire les animations.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function Halftone({
  colors,
  cell = 5,
  dot = "square",
  seed = 1,
  speed = 1,
  scale = 26,
  bias = 0,
  shape = "field",
  text,
  className,
  style,
}) {
  const ref = useRef(null);
  const key = colors.join(",");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const inks = key.split(",").map(hexToRgb);
    const levels = inks.length;
    const small = document.createElement("canvas");
    const sctx = small.getContext("2d", { willReadFrequently: true });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || speed === 0;

    let cols = 0;
    let rows = 0;
    let img = null;
    let weight = new Float32Array(0);
    let raf = 0;
    let last = 0;
    const start = performance.now();

    const buildWeight = () => {
      weight = new Float32Array(cols * rows);
      if (shape === "text" && text) {
        const t = document.createElement("canvas");
        t.width = cols;
        t.height = rows;
        const tc = t.getContext("2d", { willReadFrequently: true });
        const family = getComputedStyle(document.body).getPropertyValue("--font-display") || "sans-serif";
        let size = rows * 1.25;
        tc.font = `800 ${size}px ${family}`;
        const w = tc.measureText(text).width;
        size *= Math.min(1, (cols * 0.96) / w);
        tc.font = `800 ${size}px ${family}`;
        tc.textBaseline = "alphabetic";
        tc.fillStyle = "#000";
        const tw = tc.measureText(text).width;
        tc.fillText(text, (cols - tw) / 2, rows * 1.06);
        const a = tc.getImageData(0, 0, cols, rows).data;
        for (let i = 0; i < cols * rows; i++) weight[i] = a[i * 4 + 3] / 255;
        return;
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const u = cols > 1 ? x / (cols - 1) : 0;
          const v = rows > 1 ? y / (rows - 1) : 0;
          let w = 1;
          if (shape === "edges") w = smooth(0.18, 0.5, Math.abs(u - 0.5) * 1.05) * (0.45 + 0.55 * v);
          else if (shape === "rise") w = smooth(0.05, 1, v);
          else if (shape === "corners") w = smooth(0.25, 0.75, Math.hypot(u - 0.5, v - 0.5) * 1.35);
          else if (shape === "left") w = 1 - smooth(0.15, 1.05, Math.hypot(u * 1.1, (1 - v) * 0.95));
          else if (shape === "right") w = 1 - smooth(0.15, 1.05, Math.hypot((1 - u) * 1.1, (1 - v) * 0.95));
          weight[y * cols + x] = w;
        }
      }
    };

    const draw = (now) => {
      if (!img || !cols) return;
      const t = still ? 0 : ((now - start) / 1000) * speed * 0.35;
      const d = img.data;
      const s = seed * 1.7;
      const textMode = shape === "text";
      for (let y = 0; y < rows; y++) {
        const ny = y / scale;
        for (let x = 0; x < cols; x++) {
          const nx = x / scale;
          let n =
            0.5 +
            0.22 * Math.sin(nx * 1.7 + t * 0.6 + s) * Math.cos(ny * 1.3 - t * 0.4 + s * 1.3) +
            0.18 * Math.sin(nx * 0.8 + ny * 1.1 + t * 0.35 + s * 2.1) +
            0.1 * Math.sin(nx * 3.1 - ny * 2.3 + t * 0.9 + s * 0.7);
          const i = y * cols + x;
          const w = weight[i];
          n = textMode ? (w > 0.5 ? 0.42 + 0.58 * n : n * 0.42 * (1 - y / rows) * 0.9) : n * w;
          n += bias;
          const lvl = Math.max(0, Math.min(levels, Math.floor(n * (levels + 1) + BAYER[(y & 3) * 4 + (x & 3)] + 0.5)));
          const o = i * 4;
          if (lvl === 0) d[o + 3] = 0;
          else {
            const c = inks[lvl - 1];
            d[o] = c[0];
            d[o + 1] = c[1];
            d[o + 2] = c[2];
            d[o + 3] = 255;
          }
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cols = Math.ceil(r.width / cell);
      rows = Math.ceil(r.height / cell);
      canvas.width = Math.round(cols * cell * dpr);
      canvas.height = Math.round(rows * cell * dpr);
      small.width = cols;
      small.height = rows;
      img = sctx.createImageData(cols, rows);
      buildWeight();
      draw(performance.now());
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 40) return;
      last = now;
      draw(now);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting && !still) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    if (shape === "text") document.fonts?.ready.then(resize);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [key, cell, dot, seed, speed, scale, bias, shape, text]);

  const gap = cell >= 4 ? 1 : 0.5;
  const mask =
    dot === "round"
      ? `radial-gradient(circle, #000 ${cell * 0.36}px, transparent ${cell * 0.36 + 0.7}px) 0 0 / ${cell}px ${cell}px`
      : `linear-gradient(90deg, #000 ${cell - gap}px, transparent 0) 0 0 / ${cell}px ${cell}px, linear-gradient(#000 ${cell - gap}px, transparent 0) 0 0 / ${cell}px ${cell}px`;

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className ? `halftone ${className}` : "halftone"}
      style={{
        WebkitMask: mask,
        mask,
        maskComposite: dot === "round" ? undefined : "intersect",
        WebkitMaskComposite: dot === "round" ? undefined : "source-in",
        ...style,
      }}
    />
  );
}
