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

    function draw() {
      if (!ctx) return;
      // sky
      ctx.fillStyle = "#FFF1DD";
      ctx.fillRect(0, 0, W, H);
      // distant buildings
      ctx.fillStyle = "#F4D6AE";
      for (let i = 0; i < 6; i++) {
        const bx = ((i * 90 - (state.tick * 0.5) % 90) + 540) % 540 - 60;
        ctx.fillRect(bx, GROUND - 120, 60, 120);
      }
      // ground
      ctx.fillStyle = "#E8B984";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#D9A368";
      ctx.fillRect(0, GROUND, W, 6);

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
      }

      // obstacles
      for (const o of state.obstacles) {
        if (o.kind === 2) {
          // bird
          ctx.fillStyle = "#6B7280";
          ctx.beginPath();
          ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(o.x + 4, o.y + o.h / 2);
          ctx.lineTo(o.x - 8, o.y - 4 + ((state.tick % 20) < 10 ? 0 : 8));
          ctx.lineTo(o.x + 4, o.y + o.h / 2 - 8);
          ctx.fillStyle = "#4B5563";
          ctx.fill();
        } else {
          ctx.fillStyle = o.kind === 0 ? "#7C4A2D" : "#A56A3A";
          roundRect(ctx, o.x, o.y, o.w, o.h, 6);
          ctx.fill();
        }
      }

      // cat
      const x = CAT_X;
      const y = state.catY;
      ctx.save();
      // tail
      ctx.strokeStyle = "#F97316";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + 2, y + CAT_H - 8);
      ctx.quadraticCurveTo(x - 16, y + 4, x - 6, y - 10);
      ctx.stroke();
      // body
      ctx.fillStyle = "#F97316";
      roundRect(ctx, x, y + 6, CAT_W, CAT_H - 6, 12);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(x + CAT_W - 8, y + 12, 13, 0, Math.PI * 2);
      ctx.fill();
      // ears
      ctx.beginPath();
      ctx.moveTo(x + CAT_W - 16, y + 2);
      ctx.lineTo(x + CAT_W - 20, y - 8);
      ctx.lineTo(x + CAT_W - 10, y + 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + CAT_W - 2, y + 2);
      ctx.lineTo(x + CAT_W + 2, y - 8);
      ctx.lineTo(x + CAT_W - 8, y + 0);
      ctx.fill();
      // stripes
      ctx.strokeStyle = "#D9621A";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 10 + i * 9, y + 8);
        ctx.lineTo(x + 6 + i * 9, y + CAT_H - 2);
        ctx.stroke();
      }
      // eye
      ctx.fillStyle = "#1C1C1E";
      ctx.beginPath();
      ctx.arc(x + CAT_W - 4, y + 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // HUD
      ctx.fillStyle = "#1C1C1E";
      ctx.font = "bold 22px Fredoka, system-ui, sans-serif";
      ctx.fillText(String(scoreOf(state)), 14, 32);
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
          onGameOver({
            seed,
            inputs,
            score: scoreOf(state),
            ticks: state.tick,
          });
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
