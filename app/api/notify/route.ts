// Fires notifications to everyone who enabled them.
//
// Auth: either a Vercel Cron request (Authorization: Bearer $CRON_SECRET)
// or a manual call with ?secret=$CRON_SECRET. If CRON_SECRET isn't set, the
// route refuses to run (so nobody can spam your users).
//
// Types:
//   ?type=daily  -> "Your daily check-in is ready" (dedupes per calendar day)
//   ?type=cycle  -> "Cycle ending soon" nudge
//   custom: ?type=custom&title=...&body=...&id=...
//
// Examples:
//   GET /api/notify?type=daily&secret=XXX
//   Vercel cron hits /api/notify?type=daily with the bearer header.

import { NextRequest, NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifs";
import { kvReady } from "@/lib/kv";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = req.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!kvReady()) {
    return NextResponse.json(
      { error: "kv not configured", hint: "set KV_REST_API_URL/TOKEN" },
      { status: 503 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "daily";
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let title = "Katty Paws";
  let body = "Come play 🐾";
  let id = `generic-${today}`;

  if (type === "daily") {
    title = "Daily check-in ready 🐾";
    body = "Tap in to keep your streak alive and stack on-chain points.";
    id = `daily-${today}`;
  } else if (type === "cycle") {
    title = "Cycle ending soon ⏳";
    body = "Top 3 win USDC. Get a run in before the cycle closes!";
    id = `cycle-${today}`;
  } else if (type === "custom") {
    title = (sp.get("title") || title).slice(0, 32);
    body = (sp.get("body") || body).slice(0, 128);
    id = (sp.get("id") || `custom-${today}`).slice(0, 128);
  }

  const summary = await sendNotification({ notificationId: id, title, body });
  return NextResponse.json({ ok: true, type, ...summary });
}
