// Persistent storage for Farcaster notification tokens.
// Each user (fid) who enables notifications gives us a { url, token } pair.
// We store one record per fid and keep a set of all fids so we can broadcast.
//
// Works with either Upstash Redis env vars (UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN) or Vercel KV env vars (KV_REST_API_URL /
// KV_REST_API_TOKEN). If none are set, every function is a safe no-op so the
// app keeps working — notifications just stay dormant until the store exists.

import { Redis } from "@upstash/redis";

export type NotifRecord = { fid: number; token: string; url: string };

const URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

let client: Redis | null = null;
function kv(): Redis | null {
  if (!URL || !TOKEN) return null;
  if (!client) client = new Redis({ url: URL, token: TOKEN });
  return client;
}

export function kvReady(): boolean {
  return !!(URL && TOKEN);
}

const REC = (fid: number) => `notif:rec:${fid}`;
const SET = "notif:fids";

export async function saveToken(fid: number, token: string, url: string) {
  const r = kv();
  if (!r) return;
  await r.set(REC(fid), JSON.stringify({ fid, token, url }));
  await r.sadd(SET, String(fid));
}

export async function removeToken(fid: number) {
  const r = kv();
  if (!r) return;
  await r.del(REC(fid));
  await r.srem(SET, String(fid));
}

export async function getRecord(fid: number): Promise<NotifRecord | null> {
  const r = kv();
  if (!r) return null;
  const raw = await r.get<string | NotifRecord>(REC(fid));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as NotifRecord) : raw;
}

export async function getAllRecords(): Promise<NotifRecord[]> {
  const r = kv();
  if (!r) return [];
  const fids = await r.smembers(SET);
  if (!fids || fids.length === 0) return [];
  const recs = await Promise.all(fids.map((f) => getRecord(Number(f))));
  return recs.filter((x): x is NotifRecord => !!x);
}
