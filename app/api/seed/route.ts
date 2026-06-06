import { NextResponse } from "next/server";
import { issueSeed } from "@/lib/seedToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const issued = issueSeed();
  if (!issued) {
    return NextResponse.json({ error: "Seed not configured" }, { status: 500 });
  }
  return NextResponse.json(issued, { headers: { "Cache-Control": "no-store" } });
}
