// Server-only. Issues and verifies tamper-proof run seeds.
//
// Why: the client must NOT choose its own seed, or a bot can shop thousands of
// seeds offline and submit the easiest. The server issues a random seed signed
// with an HMAC so it can't be forged, stamped with the issue time so we can
// later check the run wasn't submitted faster than it could be played.
//
// The HMAC key is derived from SIGNER_PRIVATE_KEY (already set in the
// environment for score signing) so no new secret is required.

import crypto from "crypto";

const MAX_AGE_MS = 30 * 60 * 1000; // a seed is good for 30 minutes

function hmacKey(): string | null {
  const pk = process.env.SIGNER_PRIVATE_KEY;
  return pk ? "katty-seed-v1:" + pk : null;
}

function sign(payload: string, key: string): string {
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

export function issueSeed(): { seed: number; token: string } | null {
  const key = hmacKey();
  if (!key) return null;
  const seed = crypto.randomBytes(4).readUInt32LE(0) | 0;
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${seed}.${issuedAt}.${nonce}`;
  return { seed, token: `${payload}.${sign(payload, key)}` };
}

export function verifySeed(
  token: unknown
): { seed: number; issuedAt: number } | null {
  const key = hmacKey();
  if (!key || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [seedStr, issuedStr, nonce, sig] = parts;

  const payload = `${seedStr}.${issuedStr}.${nonce}`;
  const expected = sign(payload, key);

  // constant-time signature comparison
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const seed = Number(seedStr);
  const issuedAt = Number(issuedStr);
  if (!Number.isFinite(seed) || !Number.isFinite(issuedAt)) return null;

  const age = Date.now() - issuedAt;
  if (age > MAX_AGE_MS) return null; // expired
  if (age < -60_000) return null; // future-dated / clock nonsense

  return { seed: seed | 0, issuedAt };
}
