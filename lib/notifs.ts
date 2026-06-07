// Sends Farcaster Mini App notifications.
//
// You POST to the per-user notification `url` with up to 100 tokens at a time:
//   { notificationId, title, body, targetUrl, tokens: [...] }
// and get back { result: { successfulTokens, invalidTokens, rateLimitedTokens } }.
// Tokens that come back invalid are pruned from storage.
//
// targetUrl MUST be on your exact app domain or the notification is dropped.

import { getAllRecords, removeToken, NotifRecord } from "./kv";

const APP_URL =
  process.env.NEXT_PUBLIC_URL || "https://katty-paws-u4ng.vercel.app";

type SendArgs = {
  notificationId: string; // stable id -> (fid, id) dedupes over 24h
  title: string; // <= 32 chars
  body: string; // <= 128 chars
  targetUrl?: string; // must be on app domain; defaults to home
  recipients?: NotifRecord[]; // defaults to everyone in storage
};

export type SendSummary = {
  attempted: number;
  successful: number;
  invalid: number;
  rateLimited: number;
};

export async function sendNotification(args: SendArgs): Promise<SendSummary> {
  const targetUrl = (args.targetUrl || APP_URL).slice(0, 256);
  const title = args.title.slice(0, 32);
  const body = args.body.slice(0, 128);
  const notificationId = args.notificationId.slice(0, 128);

  const recipients = args.recipients ?? (await getAllRecords());
  const summary: SendSummary = {
    attempted: recipients.length,
    successful: 0,
    invalid: 0,
    rateLimited: 0,
  };
  if (recipients.length === 0) return summary;

  // Group tokens by their notification url (differs per Farcaster client).
  const byUrl = new Map<string, NotifRecord[]>();
  for (const rec of recipients) {
    const list = byUrl.get(rec.url) || [];
    list.push(rec);
    byUrl.set(rec.url, list);
  }

  for (const [url, recs] of byUrl) {
    // batch in chunks of 100 tokens
    for (let i = 0; i < recs.length; i += 100) {
      const chunk = recs.slice(i, i + 100);
      const tokenToFid = new Map(chunk.map((r) => [r.token, r.fid]));
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens: chunk.map((r) => r.token),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          result?: {
            successfulTokens?: string[];
            invalidTokens?: string[];
            rateLimitedTokens?: string[];
          };
        };
        const r = json.result || {};
        summary.successful += r.successfulTokens?.length || 0;
        summary.rateLimited += r.rateLimitedTokens?.length || 0;
        const invalid = r.invalidTokens || [];
        summary.invalid += invalid.length;
        // prune invalid tokens so we stop trying dead recipients
        for (const t of invalid) {
          const fid = tokenToFid.get(t);
          if (fid != null) await removeToken(fid);
        }
      } catch {
        // network error — leave tokens in place, try again next run
      }
    }
  }
  return summary;
}
