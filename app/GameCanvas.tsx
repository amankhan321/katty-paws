"use client";

import { useEffect, useRef } from "react";
import {
  createGame,
  step,
  scoreOf,
  W,
  H,
  GROUND,
  CAT_X,
  CAT_W,
  CAT_H,
  type GameState,
} from "@/lib/sim";

export type RunResult = {
  seed: number;
  inputs: number[];
  score: number;
  ticks: number;
};

const STEP_MS = 1000 / 60;

export default function GameCanvas({
  onGameOver,
}: {
  onGameOver: (r: RunResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seed = (Date.now() ^ (Math.random() * 1e9)) | 0;
    const state: GameState = createGame(seed);
    const inputs: number[] = [];
    let jumpQueued = false;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let done = false;

    const queueJump = () => {
      jumpQueued = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        queueJump();
      }
    };
    const onPointer = (e: Event) => {
      e.preventDefault();
      queueJump();
    };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    function drawCat() {
      if (!ctx) return;
      const grounded = state.catY >= GROUND - CAT_H - 0.5;
      const bob = grounded ? Math.sin(state.tick * 0.4) * 1.6 : 0;
      const x = CAT_X;
      const y = state.catY + bob;
      const t = state.tick;

      const ORANGE = "#F97316";
      const DARK = "#E2670F";
      const STRIPE = "#C2540C";
      const PINK = "#FCA5A5";

      // ground shadow (shrinks as the cat jumps higher)
      const off = Math.max(0, GROUND - CAT_H - state.catY);
      const sScale = Math.max(0.35, 1 - off / 200);
      ctx.fillStyle = `rgba(120,80,40,${0.2 * sScale})`;
      ctx.beginPath();
      ctx.ellipse(x + CAT_W / 2, GROUND - 2, (CAT_W / 2 + 4) * sScale, 6 * sScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // legs
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      const drawLeg = (lx: number, swing: number) => {
        const topY = y + CAT_H - 12;
        if (grounded) {
          const sw = Math.sin(swing);
          ctx.beginPath();
          ctx.moveTo(lx, topY);
          ctx.lineTo(lx + Math.cos(swing) * 5, topY + 12 - Math.max(0, sw) * 7);
          ctx.stroke();
        } else {
          // tucked in mid-air
          ctx.beginPath();
          ctx.moveTo(lx, topY);
          ctx.lineTo(lx + 3, topY + 6);
          ctx.stroke();
        }
      };
      const ph = t * 0.5;
      drawLeg(x + 11, ph);
      drawLeg(x + 19, ph + Math.PI);
      drawLeg(x + CAT_W - 17, ph + Math.PI);
      drawLeg(x + CAT_W - 9, ph);

      // tail (wags)
      const wag = Math.sin(t * 0.3) * 8;
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + CAT_H - 14);
      ctx.quadraticCurveTo(x - 18, y + 6 + wag, x - 8, y - 12 + wag);
      ctx.stroke();
      // tail stripes
      ctx.strokeStyle = STRIPE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 4 + wag);
      ctx.lineTo(x - 4, y - 2 + wag);
      ctx.stroke();

      // body
      ctx.fillStyle = ORANGE;
      roundRect(ctx, x + 2, y + 6, CAT_W - 4, CAT_H - 8, 14);
      ctx.fill();
      // rounded haunch at the back
      ctx.beginPath();
      ctx.arc(x + 12, y + CAT_H / 2 + 3, 13, 0, Math.PI * 2);
      ctx.fill();

      // body stripes
      ctx.strokeStyle = STRIPE;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 16 + i * 8, y + 8);
        ctx.lineTo(x + 13 + i * 8, y + CAT_H - 6);
        ctx.stroke();
      }

      // head
      const hx = x + CAT_W - 4;
      const hy = y + 12;
      ctx.fillStyle = ORANGE;
      ctx.beginPath();
      ctx.arc(hx, hy, 14, 0, Math.PI * 2);
      ctx.fill();

      // ears
      const ear = (ex: number, tipx: number) => {
        ctx.beginPath();
        ctx.moveTo(ex, hy - 8);
        ctx.lineTo(tipx, hy - 20);
        ctx.lineTo(ex + 9, hy - 9);
        ctx.closePath();
        ctx.fillStyle = ORANGE;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ex + 2, hy - 10);
        ctx.lineTo(tipx, hy - 17);
        ctx.lineTo(ex + 7, hy - 10);
        ctx.closePath();
        ctx.fillStyle = PINK;
        ctx.fill();
      };
      ear(hx - 12, hx - 14);
      ear(hx + 2, hx + 4);

      // cheek + eye + nose + whiskers
      ctx.fillStyle = "#FFD9B0";
      ctx.beginPath();
      ctx.arc(hx + 4, hy + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1C1C1E";
      ctx.beginPath();
      ctx.arc(hx + 3, hy - 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(hx + 3.8, hy - 1.8, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.moveTo(hx + 9, hy + 2);
      ctx.lineTo(hx + 13, hy + 1);
      ctx.lineTo(hx + 11, hy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(60,40,20,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + 11, hy + 3);
      ctx.lineTo(hx + 20, hy + 1);
      ctx.moveTo(hx + 11, hy + 4);
      ctx.lineTo(hx + 20, hy + 5);
      ctx.stroke();
    }

    function draw() {
      if (!ctx) return;
      // ---- SKY ----
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, "#8FD3FF");
      sky.addColorStop(0.55, "#CFEBFF");
      sky.addColorStop(1, "#FCE6C4");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, GROUND + 1);

      // sun glow
      ctx.fillStyle = "rgba(255,246,214,0.5)";
      ctx.beginPath();
      ctx.arc(W - 60, 72, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,251,236,0.95)";
      ctx.beginPath();
      ctx.arc(W - 60, 72, 36, 0, Math.PI * 2);
      ctx.fill();

      // clouds (slow parallax)
      const cloud = (cx: number, cy: number, sc: number) => {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.arc(cx, cy, 16 * sc, 0, Math.PI * 2);
        ctx.arc(cx + 18 * sc, cy + 4 * sc, 20 * sc, 0, Math.PI * 2);
        ctx.arc(cx + 40 * sc, cy, 15 * sc, 0, Math.PI * 2);
        ctx.arc(cx + 20 * sc, cy - 9 * sc, 16 * sc, 0, Math.PI * 2);
        ctx.fill();
      };
      const span = W + 180;
      const cs = (state.tick * 0.25) % span;
      cloud(((span - cs + 40) % span) - 40, 58, 1.1);
      cloud(((span - cs + 260) % span) - 40, 116, 0.8);
      cloud(((span - cs + 120) % span) - 40, 150, 0.95);

      // far hazy skyline + warm mid buildings
      drawBand(ctx, state.tick * 0.6, 70, GROUND, 70, ["#AFC9DE", "#BCD3E5", "#A7C2D8"], false);
      drawBand(ctx, state.tick * 1.15, 150, GROUND, 62, ["#E6C094", "#D4A276", "#C89068", "#EBD2AC"], true);

      // ---- GROUND ----
      const gnd = ctx.createLinearGradient(0, GROUND, 0, H);
      gnd.addColorStop(0, "#E7B681");
      gnd.addColorStop(1, "#D49E62");
      ctx.fillStyle = gnd;
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#C98C52";
      ctx.fillRect(0, GROUND, W, 5);
      ctx.fillStyle = "rgba(255,242,218,0.6)";
      for (let i = 0; i < 10; i++) {
        const dx = ((((i * 52 - state.tick * state.speed) % 520) + 520) % 520) - 20;
        ctx.fillRect(dx, GROUND + 24, 26, 5);
      }

      // trees + lamps (foreground parallax)
      drawTrees(ctx, state.tick * 1.5, GROUND);

      // coins
      for (const c of state.coins) {
        if (c.taken) continue;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = "#F59E0B";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#B45309";
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(c.x - 2.5, c.y - 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // obstacles (high contrast so they never blend into the warm scene)
      for (const o of state.obstacles) {
        if (o.kind === 2) {
          const bx = o.x + o.w / 2;
          const by = o.y + o.h / 2;
          ctx.fillStyle = "#37474F";
          ctx.beginPath();
          ctx.ellipse(bx, by, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.stroke();
          const flap = (state.tick % 16) < 8 ? -10 : 2;
          ctx.fillStyle = "#263238";
          ctx.beginPath();
          ctx.moveTo(bx - 2, by);
          ctx.lineTo(bx - 16, by + flap);
          ctx.lineTo(bx + 4, by - 4);
          ctx.fill();
          ctx.fillStyle = "#FFB300";
          ctx.beginPath();
          ctx.moveTo(bx + o.w / 2 - 2, by);
          ctx.lineTo(bx + o.w / 2 + 7, by + 2);
          ctx.lineTo(bx + o.w / 2 - 2, by + 5);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(bx + 6, by - 3, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#111";
          ctx.beginPath();
          ctx.arc(bx + 6.6, by - 3, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // ground shadow
          ctx.fillStyle = "rgba(80,50,20,0.22)";
          ctx.beginPath();
          ctx.ellipse(o.x + o.w / 2, GROUND + 4, o.w / 2 + 4, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (o.kind === 0) {
            ctx.fillStyle = "#37474F";
            roundRect(ctx, o.x, o.y, o.w, o.h, 5);
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "rgba(255,255,255,0.92)";
            ctx.stroke();
            ctx.fillStyle = "#FF5A36";
            roundRect(ctx, o.x, o.y, o.w, 7, 4);
            ctx.fill();
          } else {
            ctx.fillStyle = "#D64541";
            roundRect(ctx, o.x, o.y, o.w, o.h, 7);
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "rgba(255,255,255,0.92)";
            ctx.stroke();
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.fillRect(o.x + 2, o.y + o.h * 0.32, o.w - 4, 3);
            ctx.fillRect(o.x + 2, o.y + o.h * 0.64, o.w - 4, 3);
          }
        }
      }

      drawCat();

      // HUD score
      ctx.fillStyle = "#1C1C1E";
      ctx.font = "bold 24px Fredoka, system-ui, sans-serif";
      ctx.fillText(String(scoreOf(state)), 14, 34);
    }

    function loop(now: number) {
      acc += now - last;
      last = now;
      let steps = 0;
      while (acc >= STEP_MS && steps < 5) {
        const j = jumpQueued;
        jumpQueued = false;
        step(state, j);
        if (j) inputs.push(state.tick);
        acc -= STEP_MS;
        steps++;
        if (!state.alive) break;
      }
      draw();
      if (!state.alive) {
        if (!done) {
          done = true;
          onGameOverRef.current({ seed, inputs, score: scoreOf(state), ticks: state.tick });
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="w-full touch-none rounded-3xl shadow-md"
      style={{ aspectRatio: `${W} / ${H}` }}
    />
  );
}

function hashB(n: number): number {
  n = n | 0;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return (n ^ (n >>> 14)) >>> 0;
}

function drawBand(
  ctx: CanvasRenderingContext2D,
  offset: number,
  range: number,
  groundY: number,
  tw: number,
  palette: string[],
  windows: boolean
) {
  const start = Math.floor(offset / tw);
  const n = Math.ceil(700 / tw) + 2;
  for (let i = -1; i < n; i++) {
    const wi = start + i;
    const x = i * tw - (offset % tw);
    const hh = 48 + (hashB(wi) % range);
    const top = groundY - hh;
    ctx.fillStyle = palette[hashB(wi * 7) % palette.length];
    ctx.fillRect(x, top, tw - 6, hh);
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(x, top, tw - 6, 4);
    if (windows) {
      ctx.fillStyle = "rgba(255,250,235,0.8)";
      const rows = Math.min(6, Math.floor(hh / 26));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 3; c++) {
          if (hashB(wi * 131 + r * 17 + c) % 5 === 0) continue;
          ctx.fillRect(x + 8 + c * 16, top + 12 + r * 22, 9, 11);
        }
      }
    }
  }
}

function drawTrees(ctx: CanvasRenderingContext2D, offset: number, groundY: number) {
  const tw = 150;
  const start = Math.floor(offset / tw);
  const n = Math.ceil(700 / tw) + 2;
  for (let i = -1; i < n; i++) {
    const wi = start + i;
    const baseX = i * tw - (offset % tw) + (hashB(wi) % 36);
    if (hashB(wi * 3) % 3 === 0) {
      ctx.strokeStyle = "#5b6b73";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseX + 110, groundY);
      ctx.lineTo(baseX + 110, groundY - 72);
      ctx.stroke();
      ctx.fillStyle = "#F6C453";
      ctx.beginPath();
      ctx.arc(baseX + 110, groundY - 74, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const tx = baseX + 28;
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(tx - 4, groundY - 38, 8, 38);
    ctx.fillStyle = "#6FB85A";
    ctx.beginPath();
    ctx.arc(tx, groundY - 46, 22, 0, Math.PI * 2);
    ctx.arc(tx - 15, groundY - 36, 15, 0, Math.PI * 2);
    ctx.arc(tx + 15, groundY - 36, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#86CC6B";
    ctx.beginPath();
    ctx.arc(tx + 4, groundY - 52, 13, 0, Math.PI * 2);
    ctx.fill();
  }
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
