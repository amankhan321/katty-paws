"use client";

import { useEffect, useRef, useState } from "react";

export type GameResult = {
  score: number;
  seed: number;
  inputs: number[]; // frame indices when the player jumped
  durationMs: number;
};

// Deterministic PRNG so a backend can replay the same run later.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 390;
const H = 560;
const GROUND = H - 90;
const GRAV = 0.85;
const JUMP_V = -13;
const DBL_V = -11.5;

export default function Game({
  onGameOver,
}: {
  onGameOver: (r: GameResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    const seed = (Math.random() * 1e9) | 0;
    const rng = mulberry32(seed);
    const inputs: number[] = [];
    const startedAt = performance.now();

    let frame = 0;
    let t = 0;
    let speed = 4;
    let coins = 0;
    let alive = true;
    let ended = false;

    const cat = { x: 64, y: GROUND, vy: 0, w: 46, h: 36, onGround: true, jumps: 0 };
    type Obs = { x: number; w: number; h: number; top: number; kind: "wall" | "barrel" | "bird" };
    let obstacles: Obs[] = [];
    let coinsArr: { x: number; y: number; got: boolean }[] = [];
    let spawn = 70;
    let coinSpawn = 90;
    let bgX = 0;

    function jump() {
      if (!alive) return;
      if (cat.onGround) {
        cat.vy = JUMP_V;
        cat.onGround = false;
        cat.jumps = 1;
        inputs.push(frame);
      } else if (cat.jumps < 2) {
        cat.vy = DBL_V;
        cat.jumps = 2;
        inputs.push(frame);
      }
    }

    const onPointer = (e: Event) => {
      e.preventDefault();
      jump();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);

    function step() {
      frame++;
      t = frame / 60;
      speed = 4 + Math.floor(t / 10) * 0.8;

      cat.vy += GRAV;
      cat.y += cat.vy;
      if (cat.y >= GROUND) {
        cat.y = GROUND;
        cat.vy = 0;
        cat.onGround = true;
        cat.jumps = 0;
      }

      spawn--;
      if (spawn <= 0) {
        const r = rng();
        let kind: Obs["kind"] = r < 0.4 ? "wall" : r < 0.74 ? "barrel" : "bird";
        let w = kind === "bird" ? 38 : 28;
        let h = kind === "wall" ? 44 : kind === "barrel" ? 32 : 26;
        let top = kind === "bird" ? GROUND - 118 : GROUND - h;
        obstacles.push({ x: W + 30, w, h, top, kind });
        const minGap = Math.max(58, 120 - Math.floor(t / 10) * 8);
        spawn = minGap + Math.floor(rng() * 40);
      }

      coinSpawn--;
      if (coinSpawn <= 0) {
        const y = GROUND - 55 - Math.floor(rng() * 70);
        coinsArr.push({ x: W + 20, y, got: false });
        coinSpawn = 70 + Math.floor(rng() * 70);
      }

      for (const o of obstacles) o.x -= speed;
      for (const c of coinsArr) c.x -= speed;
      obstacles = obstacles.filter((o) => o.x > -60);
      coinsArr = coinsArr.filter((c) => c.x > -30 && !c.got);

      const cTop = cat.y - cat.h;
      for (const o of obstacles) {
        if (
          cat.x < o.x + o.w &&
          cat.x + cat.w > o.x &&
          cTop < o.top + o.h &&
          cat.y > o.top
        ) {
          alive = false;
        }
      }
      for (const c of coinsArr) {
        if (c.got) continue;
        const dx = cat.x + cat.w / 2 - c.x;
        const dy = cat.y - cat.h / 2 - c.y;
        if (dx * dx + dy * dy < 26 * 26) {
          c.got = true;
          coins++;
        }
      }

      setScore(coins * 5 + Math.floor(t / 2));
    }

    function drawCat() {
      const bottom = cat.y;
      const x = cat.x;
      const bodyH = 22;
      const bodyY = bottom - bodyH - 8;
      ctx!.fillStyle = "#F97316";
      // body
      roundRect(ctx!, x, bodyY, cat.w, bodyH, 11);
      ctx!.fill();
      // head
      ctx!.beginPath();
      ctx!.arc(x + cat.w - 4, bodyY + 2, 13, 0, Math.PI * 2);
      ctx!.fill();
      // ears
      ctx!.beginPath();
      ctx!.moveTo(x + cat.w - 12, bodyY - 8);
      ctx!.lineTo(x + cat.w - 6, bodyY + 2);
      ctx!.lineTo(x + cat.w - 18, bodyY + 2);
      ctx!.closePath();
      ctx!.fill();
      ctx!.beginPath();
      ctx!.moveTo(x + cat.w + 2, bodyY - 8);
      ctx!.lineTo(x + cat.w + 8, bodyY + 2);
      ctx!.lineTo(x + cat.w - 4, bodyY + 2);
      ctx!.closePath();
      ctx!.fill();
      // tail
      ctx!.strokeStyle = "#F97316";
      ctx!.lineWidth = 6;
      ctx!.beginPath();
      ctx!.moveTo(x + 2, bodyY + 8);
      ctx!.quadraticCurveTo(x - 16, bodyY - 4, x - 8, bodyY - 16);
      ctx!.stroke();
      // stripes
      ctx!.fillStyle = "#C2410C";
      ctx!.fillRect(x + 14, bodyY + 3, 4, bodyH - 6);
      ctx!.fillRect(x + 24, bodyY + 3, 4, bodyH - 6);
      // eye
      ctx!.fillStyle = "#1C1C1E";
      ctx!.beginPath();
      ctx!.arc(x + cat.w, bodyY + 1, 2, 0, Math.PI * 2);
      ctx!.fill();
      // legs (run cycle) or tucked (jump)
      ctx!.fillStyle = "#EA580C";
      if (cat.onGround) {
        const swing = Math.sin(frame * 0.5) * 5;
        ctx!.fillRect(x + 8, bottom - 8, 5, 8 + swing);
        ctx!.fillRect(x + 28, bottom - 8, 5, 8 - swing);
      } else {
        ctx!.fillRect(x + 10, bottom - 6, 5, 6);
        ctx!.fillRect(x + 26, bottom - 6, 5, 6);
      }
    }

    function draw() {
      // sky
      const g = ctx!.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#2b1a3d");
      g.addColorStop(1, "#5b3a2e");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);
      // moon
      ctx!.fillStyle = "#FDE68A";
      ctx!.beginPath();
      ctx!.arc(320, 70, 26, 0, Math.PI * 2);
      ctx!.fill();
      // buildings (parallax)
      bgX = (bgX - speed * 0.4) % 90;
      ctx!.fillStyle = "#3d2a4d";
      for (let i = -1; i < 6; i++) {
        const bx = i * 90 + bgX;
        const bh = 120 + ((i * 53) % 70);
        ctx!.fillRect(bx, GROUND - bh, 70, bh);
        // fish-shop sign
        ctx!.fillStyle = "#F59E0B";
        ctx!.fillRect(bx + 12, GROUND - bh + 16, 30, 10);
        ctx!.fillStyle = "#3d2a4d";
      }
      // ground
      ctx!.fillStyle = "#1f140f";
      ctx!.fillRect(0, GROUND, W, H - GROUND);
      ctx!.fillStyle = "#33231a";
      ctx!.fillRect(0, GROUND, W, 6);

      // obstacles
      for (const o of obstacles) {
        if (o.kind === "wall") ctx!.fillStyle = "#8B5E34";
        else if (o.kind === "barrel") ctx!.fillStyle = "#B45309";
        else ctx!.fillStyle = "#94A3B8";
        roundRect(ctx!, o.x, o.top, o.w, o.h, 6);
        ctx!.fill();
        if (o.kind === "bird") {
          ctx!.fillStyle = "#CBD5E1";
          ctx!.fillRect(o.x - 6, o.top + 6, 8, 4);
          ctx!.fillRect(o.x + o.w - 2, o.top + 6, 8, 4);
        }
      }
      // coins
      for (const c of coinsArr) {
        if (c.got) continue;
        ctx!.fillStyle = "#F59E0B";
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, 9, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "#FEF3C7";
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx!.fill();
      }

      drawCat();
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += now - last;
      last = now;
      let n = 0;
      while (acc >= 1000 / 60 && n < 5) {
        if (alive) step();
        acc -= 1000 / 60;
        n++;
      }
      draw();
      if (alive) {
        raf = requestAnimationFrame(loop);
      } else if (!ended) {
        ended = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey);
        onGameOver({
          score: coins * 5 + Math.floor(t / 2),
          seed,
          inputs,
          durationMs: performance.now() - startedAt,
        });
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onGameOver]);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-2 font-display text-2xl font-bold text-kitty">
        {score}
      </div>
      <canvas
        ref={canvasRef}
        style={{ touchAction: "none", borderRadius: 20 }}
        className="shadow-lg"
      />
      <p className="mt-2 text-xs text-ink/60">Tap to jump · tap again for double jump</p>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
