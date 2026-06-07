// Farcaster POSTs here when a user adds/removes the app or toggles notifications.
// Declared as `webhookUrl` in /.well-known/farcaster.json.
//
// Events use the JSON Farcaster Signature envelope:
//   { header: base64url, payload: base64url, signature: base64url }
// header decodes to { fid, type, key }; payload decodes to the event object:
//   miniapp_added / notifications_enabled -> { event, notificationDetails:{url,token} }
//   miniapp_removed / notifications_disabled -> { event }
//
// We do a best-effort decode and store. (Cryptographic verification via
// @farcaster/miniapp-node + a Neynar key can be layered on later; a forged
// token simply gets pruned the first time we try to send to it.)

import { NextRequest, NextResponse } from "next/server";
import { saveToken, removeToken } from "@/lib/kv";

export const dynamic = "force-dynamic";

function b64urlToJson<T = any>(s: string): T | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const txt = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const header = b64urlToJson<{ fid: number }>(body?.header || "");
  const payload = b64urlToJson<{
    event: string;
    notificationDetails?: { url: string; token: string };
  }>(body?.payload || "");

  const fid = header?.fid;
  const event = payload?.event;
  if (!fid || !event) {
    // Not a shape we understand; still 200 so the client doesn't hammer retries.
    return NextResponse.json({ ok: true });
  }

  try {
    if (event === "miniapp_added" || event === "notifications_enabled") {
      const d = payload?.notificationDetails;
      if (d?.token && d?.url) await saveToken(fid, d.token, d.url);
    } else if (
      event === "miniapp_removed" ||
      event === "notifications_disabled"
    ) {
      await removeToken(fid);
    }
  } catch {
    // storage hiccup — return 200 anyway; Farcaster may retry the event
  }

  return NextResponse.json({ ok: true });
}
