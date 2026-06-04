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
      ctx.fillStyle = "#FFF1DD";
      ctx.fillRect(0, 0, W, H);
      // parallax buildings
      ctx.fillStyle = "#F4D6AE";
      for (let i = 0; i < 7; i++) {
        const bx = (((i * 80 - state.tick * 0.5) % 560) + 560) % 560 - 80;
        ctx.fillRect(bx, GROUND - 110, 56, 110);
      }
      // ground
      ctx.fillStyle = "#E8B984";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#D9A368";
      ctx.fillRect(0, GROUND, W, 6);
      // ground dashes (motion)
      ctx.fillStyle = "rgba(180,120,70,0.5)";
      for (let i = 0; i < 10; i++) {
        const dx = (((i * 48 - state.tick * state.speed) % 480) + 480) % 480;
        ctx.fillRect(dx, GROUND + 18, 22, 4);
      }

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

      // obstacles
      for (const o of state.obstacles) {
        if (o.kind === 2) {
          ctx.fillStyle = "#6B7280";
          ctx.beginPath();
          ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#4B5563";
          ctx.beginPath();
          const flap = (state.tick % 18) < 9 ? -8 : 4;
          ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
          ctx.lineTo(o.x + o.w / 2 - 14, o.y + flap);
          ctx.lineTo(o.x + o.w / 2 + 2, o.y + o.h / 2 - 2);
          ctx.fill();
        } else {
          ctx.fillStyle = o.kind === 0 ? "#7C4A2D" : "#A56A3A";
          roundRect(ctx, o.x, o.y, o.w, o.h, 6);
          ctx.fill();
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
          onGameOver({ seed, inputs, score: scoreOf(state), ticks: state.tick });
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
  }, [onGameOver]);

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
