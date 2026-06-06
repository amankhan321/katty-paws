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
  inputs: number[];
  score: number;
  ticks: number;
};

const STEP_MS = 1000 / 60;

export default function GameCanvas({
  onGameOver,
  skin,
  seed,
}: {
  onGameOver: (r: RunResult) => void;
  skin: { body: string; dark: string; stripe: string; pink: string; belly: string };
  seed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;
  const skinRef = useRef(skin);
  skinRef.current = skin;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at device resolution so the larger canvas stays crisp.
    const dpr = Math.min(2, (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const state: GameState = createGame(seed);
    const inputs: number[] = [];
    let jumpQueued = false;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let done = false;
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g: number };
    const parts: P[] = [];
    const pops: { x: number; y: number; life: number; text: string }[] = [];
    let shake = 0;
    let prevCoins = 0;
    let prevShield = false;
    let dispScore = 0;
    let scorePulse = 0;
    let deathFrames = -1;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const burst = (x: number, y: number, n: number, colors: string[], spd: number, g: number) => {
      for (let i = 0; i < n; i++) {
        const ang = rnd(0, Math.PI * 2);
        const sp = rnd(spd * 0.3, spd);
        parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, max: rnd(0.5, 1), color: colors[(Math.random() * colors.length) | 0], size: rnd(2, 4.5), g });
      }
    };
    const dust = (x: number, y: number) => {
      for (let i = 0; i < 5; i++) parts.push({ x: x + rnd(-4, 4), y, vx: rnd(-1.2, -0.2), vy: rnd(-1.6, -0.2), life: 1, max: 0.5, color: "rgba(180,150,110,0.9)", size: rnd(2, 3.5), g: 0.05 });
    };

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

      const sk = skinRef.current;
      const ORANGE = sk.body;
      const DARK = sk.dark;
      const STRIPE = sk.stripe;
      const PINK = sk.pink;

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
      ctx.fillStyle = sk.belly;
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
      drawBand(ctx, state.tick * 0.55, 150, GROUND, 66, ["#9FB4CE", "#AEC0D6", "#93A9C6"], false);
      drawCity(ctx, state.tick * 1.15, GROUND);

      // ---- GROUND ----
      // sidewalk (the strip the cat runs on)
      ctx.fillStyle = "#CDBB9D";
      ctx.fillRect(0, GROUND, W, 14);
      ctx.strokeStyle = "rgba(120,100,70,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const sx = ((((i * 46 - state.tick * state.speed) % 560) + 560) % 560) - 40;
        ctx.beginPath();
        ctx.moveTo(sx, GROUND);
        ctx.lineTo(sx, GROUND + 14);
        ctx.stroke();
      }
      // curb
      ctx.fillStyle = "#9C8A6B";
      ctx.fillRect(0, GROUND + 14, W, 4);
      // asphalt road below
      const road = ctx.createLinearGradient(0, GROUND + 18, 0, H);
      road.addColorStop(0, "#4A4F5A");
      road.addColorStop(1, "#373B44");
      ctx.fillStyle = road;
      ctx.fillRect(0, GROUND + 18, W, H - GROUND - 18);
      // asphalt speckle / manholes
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let i = 0; i < 6; i++) {
        const mx = ((((i * 130 - state.tick * (state.speed + 2)) % 780) + 780) % 780) - 60;
        ctx.beginPath();
        ctx.ellipse(mx, GROUND + 18 + (H - GROUND - 18) * 0.78, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // center lane dashes
      ctx.fillStyle = "rgba(255,214,102,0.9)";
      const midY = GROUND + 18 + (H - GROUND - 18) / 2 - 2;
      for (let i = 0; i < 10; i++) {
        const dx = ((((i * 60 - state.tick * (state.speed + 2)) % 600) + 600) % 600) - 30;
        ctx.fillRect(dx, midY, 30, 5);
      }

      // trees + lamps (foreground parallax)
      drawTrees(ctx, state.tick * 1.5, GROUND);

      // speed lines (subtle sense of motion, grows with speed)
      const slN = Math.min(5, Math.max(0, state.speed - 4));
      if (slN > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 2;
        for (let i = 0; i < slN; i++) {
          const yy = 24 + ((i * 89) % (GROUND - 60));
          const xx = ((((i * 130 - state.tick * (state.speed + 8)) % (W + 80)) + (W + 80)) % (W + 80)) - 40;
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.lineTo(xx + 26, yy);
          ctx.stroke();
        }
      }

      // foreground gameplay jolts on impact
      let sx = 0;
      let sy = 0;
      if (shake > 0) {
        sx = (Math.random() - 0.5) * shake;
        sy = (Math.random() - 0.5) * shake;
        shake *= 0.85;
        if (shake < 0.4) shake = 0;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // coins (sticker style: white ring + dark halo so they pop on any background)
      for (const c of state.coins) {
        if (c.taken) continue;
        const ph = state.tick * 0.15 + c.x * 0.05;
        const pr = c.r * (1 + 0.12 * Math.sin(ph));
        // dark halo for separation
        ctx.fillStyle = "rgba(0,0,0,0.20)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, pr + 5, 0, Math.PI * 2);
        ctx.fill();
        // white outline ring
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(c.x, c.y, pr + 3, 0, Math.PI * 2);
        ctx.fill();
        // gold body
        ctx.beginPath();
        ctx.arc(c.x, c.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = "#FFC42E";
        ctx.fill();
        // dark rim
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#8A4B0A";
        ctx.stroke();
        // inner ring detail
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, pr * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        // shine dot
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(c.x - 2.5 + Math.cos(ph) * 2, c.y - 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
        // sparkle
        const spk = (Math.sin(ph * 1.7) + 1) / 2;
        ctx.globalAlpha = spk;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x + pr + 4, c.y);
        ctx.lineTo(c.x + pr + 8, c.y);
        ctx.moveTo(c.x, c.y - pr - 4);
        ctx.lineTo(c.x, c.y - pr - 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
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

      // shield bubble (inside the shake group, around the cat)
      if (state.shieldTicks > 0) {
        const sxm = CAT_X + CAT_W / 2;
        const sym = state.catY + CAT_H / 2;
        const tleft = state.shieldTicks / 300;
        const pr2 = 32 + Math.sin(state.tick * 0.4) * 2;
        ctx.fillStyle = "rgba(99,179,255,0.16)";
        ctx.beginPath();
        ctx.arc(sxm, sym, pr2 + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,190,255,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sxm, sym, pr2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#3F9CFF";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sxm, sym, pr2, -Math.PI / 2, -Math.PI / 2 + tleft * Math.PI * 2);
        ctx.stroke();
        const oa = state.tick * 0.25;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(sxm + Math.cos(oa) * pr2, sym + Math.sin(oa) * pr2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // particles + floating "+5" pops (inside the shake group)
      for (const pt of parts) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += pt.g;
        pt.life -= (1 / 60) / pt.max;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      for (const pp of pops) {
        pp.y -= 0.8;
        pp.life -= 0.02;
      }
      for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
      for (const pt of parts) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = "bold 16px Fredoka, system-ui, sans-serif";
      for (const pp of pops) {
        ctx.globalAlpha = Math.max(0, pp.life);
        ctx.fillStyle = "#F59E0B";
        ctx.fillText(pp.text, pp.x, pp.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // HUD score (animated, fixed — outside the shake)
      const real = scoreOf(state);
      if (real > dispScore) {
        dispScore = real;
        scorePulse = 1;
      }
      scorePulse *= 0.88;
      ctx.save();
      ctx.font = "bold 26px Fredoka, system-ui, sans-serif";
      const pillTxt = `${real}`;
      const tw = ctx.measureText(pillTxt).width;
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      roundRect(ctx, 12, 12, tw + 54, 38, 19);
      ctx.fill();
      ctx.fillStyle = "#F8B72B";
      ctx.beginPath();
      ctx.arc(34, 31, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#B45309";
      ctx.stroke();
      const scp = 1 + 0.28 * Math.max(0, scorePulse);
      ctx.translate(56, 32);
      ctx.scale(scp, scp);
      ctx.fillStyle = "#1C1C1E";
      ctx.textBaseline = "middle";
      ctx.fillText(pillTxt, 0, 0);
      ctx.restore();

      // combo pips / shield countdown (top-right)
      if (state.shieldTicks > 0) {
        const secs = Math.ceil(state.shieldTicks / 60);
        ctx.font = "bold 14px Fredoka, system-ui, sans-serif";
        const label = `SHIELD ${secs}s`;
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(63,156,255,0.95)";
        roundRect(ctx, W - lw - 32, 14, lw + 20, 28, 14);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, W - lw - 22, 29);
        ctx.textBaseline = "alphabetic";
      } else {
        const gap = 9;
        const startX = W - 12 - gap * 9;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          ctx.arc(startX + i * gap, 24, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = i < state.combo ? "#F8B72B" : "rgba(0,0,0,0.13)";
          ctx.fill();
        }
      }
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
        if (state.coinsCollected > prevCoins) {
          pops.push({ x: CAT_X + CAT_W, y: state.catY + 4, life: 1, text: "+5" });
          burst(CAT_X + CAT_W, state.catY + 8, 8, ["#FFD56B", "#F59E0B", "#ffffff"], 3, 0.08);
          prevCoins = state.coinsCollected;
        }
        if (j && state.jumps === 1) dust(CAT_X + CAT_W / 2, GROUND - 2);
        if (state.shieldTicks > 0 && !prevShield) {
          pops.push({ x: CAT_X + CAT_W / 2 - 18, y: state.catY - 6, life: 1.6, text: "SHIELD!" });
          burst(CAT_X + CAT_W / 2, state.catY + CAT_H / 2, 24, ["#63B3FF", "#A0D8FF", "#ffffff", "#4DA3FF"], 5, 0.05);
        }
        prevShield = state.shieldTicks > 0;
        acc -= STEP_MS;
        steps++;
        if (!state.alive) break;
      }
      draw();
      if (!state.alive) {
        if (!done) {
          if (deathFrames < 0) {
            deathFrames = 28;
            shake = 18;
            burst(CAT_X + CAT_W / 2, state.catY + CAT_H / 2, 28, ["#F97316", "#FF5A36", "#FFD56B", "#ffffff"], 6.5, 0.2);
          } else if (deathFrames === 0) {
            done = true;
            onGameOverRef.current({ inputs, score: scoreOf(state), ticks: state.tick });
            return;
          }
          deathFrames--;
          raf = requestAnimationFrame(loop);
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
      className="w-full touch-none rounded-2xl shadow-lg"
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

function drawCity(ctx: CanvasRenderingContext2D, offset: number, groundY: number) {
  const tw = 60;
  const start = Math.floor(offset / tw);
  const n = Math.ceil(700 / tw) + 2;
  const pal = ["#7E8AA0", "#9AA0AE", "#B0743F", "#C98A5A", "#8895AE", "#6E7A92"];
  for (let i = -1; i < n; i++) {
    const wi = start + i;
    const x = i * tw - (offset % tw);
    const tall = hashB(wi) % 5 === 0;
    const hh = (tall ? 150 : 64) + (hashB(wi * 7) % (tall ? 120 : 70));
    const bw = tw - 8 - (hashB(wi * 5) % 8);
    const top = groundY - hh;
    const col = pal[hashB(wi * 13) % pal.length];
    ctx.fillStyle = col;
    ctx.fillRect(x, top, bw, hh);
    // shaded right edge for depth
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(x + bw - 5, top, 5, hh);
    // roof detail
    if (tall) {
      const sbw = bw * 0.6;
      const sbh = 28 + (hashB(wi * 3) % 28);
      ctx.fillStyle = col;
      ctx.fillRect(x + (bw - sbw) / 2, top - sbh, sbw, sbh);
      ctx.strokeStyle = "#5B6470";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + bw / 2, top - sbh);
      ctx.lineTo(x + bw / 2, top - sbh - 22);
      ctx.stroke();
      ctx.fillStyle = "#E2483C";
      ctx.beginPath();
      ctx.arc(x + bw / 2, top - sbh - 22, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (hashB(wi * 9) % 3 === 0) {
      // rooftop water tank
      ctx.fillStyle = "#6B4A2B";
      ctx.fillRect(x + bw / 2 - 6, top - 11, 12, 11);
      ctx.beginPath();
      ctx.moveTo(x + bw / 2 - 7, top - 11);
      ctx.lineTo(x + bw / 2, top - 17);
      ctx.lineTo(x + bw / 2 + 7, top - 11);
      ctx.closePath();
      ctx.fill();
    }
    // windows
    const cols = Math.max(2, Math.floor(bw / 12));
    const rows = Math.floor(hh / 16);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = hashB(wi * 131 + r * 7 + c) % 4 !== 0;
        ctx.fillStyle = lit ? "rgba(255,244,206,0.85)" : "rgba(40,50,70,0.32)";
        ctx.fillRect(x + 5 + c * 12, top + 8 + r * 16, 7, 9);
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
