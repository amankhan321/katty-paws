// Deterministic cat-runner simulation.
// The SAME code runs in the browser (to play) and on the server (to replay and
// validate a submitted run). Given a seed + the list of ticks the player jumped,
// the outcome is fully reproducible — that's what lets the backend sign honest
// scores without trusting a client-reported number.

export type Kind = 0 | 1 | 2; // 0 wall, 1 barrel, 2 bird
export type Obstacle = { x: number; w: number; h: number; y: number; kind: Kind };
export type Coin = { x: number; y: number; r: number; taken: boolean };

export type GameState = {
  tick: number;
  rngState: number;
  catY: number;
  vy: number;
  jumps: number;
  obstacles: Obstacle[];
  coins: Coin[];
  nextSpawn: number;
  coinsCollected: number;
  speed: number;
  alive: boolean;
};

// Logical canvas dims (CSS-scaled to device width).
export const W = 390;
export const H = 520;
export const GROUND = H - 70;
export const CAT_X = 64;
export const CAT_W = 44;
export const CAT_H = 38;

const GRAV = 0.9;
const JUMP = -15;
const JUMP2 = -13;

// mulberry32 PRNG step. Returns [value 0..1, nextState].
function rng(state: number): readonly [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const v = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [v, (state + 0x6d2b79f5) | 0];
}

export function createGame(seed: number): GameState {
  return {
    tick: 0,
    rngState: seed | 0,
    catY: GROUND - CAT_H,
    vy: 0,
    jumps: 0,
    obstacles: [],
    coins: [],
    nextSpawn: 60,
    coinsCollected: 0,
    speed: 4,
    alive: true,
  };
}

// Advance one fixed tick. `jump` = a new jump press happened this tick.
export function step(s: GameState, jump: boolean): GameState {
  if (!s.alive) return s;
  s.tick++;
  s.speed = 4 + Math.floor(s.tick / 600); // ramps every 10s @60fps

  if (jump) {
    const onGround = s.catY >= GROUND - CAT_H - 0.5;
    if (onGround) {
      s.vy = JUMP;
      s.jumps = 1;
    } else if (s.jumps < 2) {
      s.vy = JUMP2;
      s.jumps = 2;
    }
  }

  s.vy += GRAV;
  s.catY += s.vy;
  if (s.catY > GROUND - CAT_H) {
    s.catY = GROUND - CAT_H;
    s.vy = 0;
    s.jumps = 0;
  }

  for (const o of s.obstacles) o.x -= s.speed;
  for (const c of s.coins) c.x -= s.speed;
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
  s.coins = s.coins.filter((c) => c.x + c.r > -20);

  if (s.tick >= s.nextSpawn) {
    let r: number;
    [r, s.rngState] = rng(s.rngState);
    const kind: Kind = r < 0.4 ? 0 : r < 0.75 ? 1 : 2;
    let o: Obstacle;
    if (kind === 0) o = { x: W + 20, w: 26, h: 48, y: GROUND - 48, kind };
    else if (kind === 1) o = { x: W + 20, w: 34, h: 30, y: GROUND - 30, kind };
    else o = { x: W + 20, w: 38, h: 26, y: GROUND - 96, kind }; // bird = high, needs double jump
    s.obstacles.push(o);

    let r2: number;
    [r2, s.rngState] = rng(s.rngState);
    if (r2 < 0.7) {
      const cy = GROUND - 72 - Math.floor(r2 * 46);
      s.coins.push({ x: W + 110, y: cy, r: 9, taken: false });
    }

    let g: number;
    [g, s.rngState] = rng(s.rngState);
    const gap = Math.max(52, 112 - s.speed * 4) + Math.floor(g * 40);
    s.nextSpawn = s.tick + gap;
  }

  const cx = CAT_X,
    cy = s.catY,
    cw = CAT_W,
    ch = CAT_H;
  for (const o of s.obstacles) {
    if (cx < o.x + o.w && cx + cw > o.x && cy < o.y + o.h && cy + ch > o.y) {
      s.alive = false;
    }
  }
  for (const c of s.coins) {
    if (
      !c.taken &&
      cx < c.x + c.r &&
      cx + cw > c.x - c.r &&
      cy < c.y + c.r &&
      cy + ch > c.y - c.r
    ) {
      c.taken = true;
      s.coinsCollected++;
    }
  }
  return s;
}

export function scoreOf(s: GameState): number {
  return s.coinsCollected * 5 + Math.floor(s.tick / 120); // +5/coin, +1 per 2s
}

// Replay a run from seed + jump ticks. Used by the server validator.
export function replay(seed: number, jumpTicks: number[], maxTicks = 60000): number {
  const set = new Set(jumpTicks);
  const s = createGame(seed);
  while (s.alive && s.tick < maxTicks) {
    step(s, set.has(s.tick + 1));
  }
  return scoreOf(s);
}
