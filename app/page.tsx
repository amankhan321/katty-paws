"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { KATTY_PAWS_ADDRESS, PLAY_FEE, BUILDER_SUFFIX, kattyPawsAbi } from "@/lib/contract";
import GameCanvas, { type RunResult } from "./GameCanvas";

type Screen = "home" | "playing" | "over";
type Tab = "play" | "leaderboard" | "profile";
type FcUser = { fid?: number; username?: string; pfpUrl?: string };

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

function fmtTime(secs: number) {
  if (secs <= 0) return "ended";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<FcUser | null>(null);
  const [clientLabel, setClientLabel] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<Tab>("play");
  const [run, setRun] = useState<RunResult | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string>("");

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const pay = useWriteContract();
  const payRcpt = useWaitForTransactionReceipt({ hash: pay.data });
  const sub = useWriteContract();
  const subRcpt = useWaitForTransactionReceipt({ hash: sub.data });

  const { data: cycleId } = useReadContract({
    address: KATTY_PAWS_ADDRESS,
    abi: kattyPawsAbi,
    functionName: "cycleId",
  });
  const cid = (cycleId ?? 1n) as bigint;

  const { data: top } = useReadContract({
    address: KATTY_PAWS_ADDRESS,
    abi: kattyPawsAbi,
    functionName: "getTop",
    args: [cid],
    query: { refetchInterval: 15000 },
  });
  const { data: timeLeft } = useReadContract({
    address: KATTY_PAWS_ADDRESS,
    abi: kattyPawsAbi,
    functionName: "timeLeft",
    query: { refetchInterval: 30000 },
  });
  const { data: myBest } = useReadContract({
    address: KATTY_PAWS_ADDRESS,
    abi: kattyPawsAbi,
    functionName: "bestScore",
    args: [cid, (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
    query: { enabled: !!address },
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const ctx: any = await sdk.context;
        if (alive && ctx?.user) {
          setUser({ fid: ctx.user.fid, username: ctx.user.username, pfpUrl: ctx.user.pfpUrl });
        }
        // best-effort: which client opened the app
        const cf = ctx?.client?.clientFid;
        if (cf === 309857) setClientLabel("Base App");
        else if (cf) setClientLabel("Farcaster");
        await sdk.actions.ready();
      } catch {
        /* outside Farcaster — still render */
      } finally {
        if (alive) setBooted(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (payRcpt.isSuccess && screen !== "playing") {
      setScreen("playing");
      pay.reset();
    }
  }, [payRcpt.isSuccess, screen, pay]);

  useEffect(() => {
    if (subRcpt.isSuccess) setSubmitMsg("Saved on-chain ✅");
  }, [subRcpt.isSuccess]);

  const startPay = useCallback(() => {
    setSubmitMsg("");
    sub.reset();
    pay.reset();
    pay.writeContract({
      address: KATTY_PAWS_ADDRESS,
      abi: kattyPawsAbi,
      functionName: "payToPlay",
      value: PLAY_FEE,
      dataSuffix: BUILDER_SUFFIX,
    });
  }, [pay, sub]);

  const onGameOver = useCallback(
    (r: RunResult) => {
      sub.reset();
      setSubmitMsg("");
      setRun(r);
      setScreen("over");
    },
    [sub]
  );

  const submitScore = useCallback(async () => {
    if (!run || !address) return;
    setSubmitMsg("Validating run…");
    try {
      const res = await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          seed: run.seed,
          inputs: run.inputs,
          score: run.score,
          cycleId: Number(cid),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "Validation failed");
        return;
      }
      setSubmitMsg("Confirm in wallet to save on-chain…");
      sub.writeContract({
        address: KATTY_PAWS_ADDRESS,
        abi: kattyPawsAbi,
        functionName: "submitScore",
        dataSuffix: BUILDER_SUFFIX,
        args: [BigInt(data.score), BigInt(data.nonce), data.signature as `0x${string}`],
      });
    } catch {
      setSubmitMsg("Network error — try again");
    }
  }, [run, address, cid, sub]);

  if (!booted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-bob text-6xl">🐱</div>
      </main>
    );
  }

  // ---------- PLAYING ----------
  if (screen === "playing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center px-3">
        <p className="mb-2 text-center text-sm text-ink/60">Tap to jump · tap twice to clear birds</p>
        <GameCanvas onGameOver={onGameOver} />
      </main>
    );
  }

  // ---------- GAME OVER ----------
  if (screen === "over" && run) {
    const saving = sub.isPending || subRcpt.isLoading;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col items-center justify-center px-5">
        <div className="animate-pop w-full rounded-3xl bg-white/80 p-6 text-center shadow-md">
          <div className="text-5xl">🐾</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">Run over!</h2>
          <p className="mt-4 font-display text-5xl font-bold text-kitty">{run.score}</p>
          <p className="text-sm text-ink/60">points this run</p>
          <button
            onClick={submitScore}
            disabled={saving || subRcpt.isSuccess}
            className="mt-6 w-full rounded-2xl bg-gold py-3 font-display text-lg font-bold text-white shadow active:scale-[0.98] disabled:opacity-60"
          >
            {subRcpt.isSuccess ? "On the leaderboard ✅" : saving ? "Saving…" : "Submit to leaderboard"}
          </button>
          <button
            onClick={() => {
              setScreen("home");
              setTab("play");
            }}
            className="mt-3 w-full rounded-2xl bg-kitty py-3 font-display text-lg font-bold text-white shadow active:scale-[0.98]"
          >
            Play again 🐾
          </button>
          {submitMsg && <p className="mt-3 text-sm text-ink/70">{submitMsg}</p>}
        </div>
      </main>
    );
  }

  // ---------- HOME (tabs + nav) ----------
  const wallets = (top?.[0] ?? []) as readonly string[];
  const scores = (top?.[1] ?? []) as readonly bigint[];
  const myRank = address
    ? wallets.findIndex((w) => w?.toLowerCase() === address.toLowerCase())
    : -1;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-kitty">Katty Paws</h1>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink shadow-sm">
          {timeLeft !== undefined ? fmtTime(Number(timeLeft)) + " left" : "Base"}
        </span>
      </header>

      {/* Profile card (always visible) */}
      <section className="mt-5 flex items-center gap-3 rounded-3xl bg-white/70 p-4 shadow-sm">
        {user?.pfpUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.pfpUrl}
            alt="pfp"
            className="h-12 w-12 rounded-full border-2 border-gold object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-peach text-2xl">
            🐾
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {user?.username ? `@${user.username}` : "Guest cat"}
          </p>
          <p className="truncate text-xs text-ink/60">
            {isConnected && address ? short(address) : "Wallet not connected"}
          </p>
        </div>
        {clientLabel && (
          <span className="rounded-full bg-peach px-2 py-1 text-[10px] font-bold text-ink/70">
            {clientLabel}
          </span>
        )}
      </section>

      {/* TAB CONTENT */}
      <div className="mt-4 flex-1">
        {tab === "play" && (
          <div className="flex h-full flex-col">
            <section className="flex flex-1 flex-col items-center justify-center">
              <div className="animate-bob select-none text-[120px] leading-none">🐈</div>
              <p className="mt-2 font-display text-xl font-semibold text-ink/80">Ready to run?</p>
              <p className="mt-1 text-center text-sm text-ink/60">
                Pay a tiny fee to start a run. Top 3 scores this cycle win USDC.
              </p>
              {myBest !== undefined && Number(myBest) > 0 && (
                <p className="mt-3 rounded-full bg-white/70 px-4 py-1 text-sm font-semibold text-ink">
                  Your best: {Number(myBest)}
                </p>
              )}
            </section>
            <section className="mt-6">
              {!isConnected ? (
                <button
                  onClick={() => connect({ connector: connectors[0] })}
                  className="w-full rounded-2xl bg-ink py-4 font-display text-lg font-semibold text-white shadow-md active:scale-[0.98]"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  onClick={startPay}
                  disabled={pay.isPending || payRcpt.isLoading}
                  className="w-full rounded-2xl bg-kitty py-4 font-display text-lg font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {pay.isPending ? "Confirm in wallet…" : payRcpt.isLoading ? "Starting on Base…" : "Play Now 🐾"}
                </button>
              )}
              {pay.error && (
                <p className="mt-3 text-center text-sm text-red-600">Transaction needed to play 🐾</p>
              )}
              <p className="mt-3 text-center text-[11px] text-ink/50">
                ~$0.003 play fee on Base · powered by player fees 🐱
              </p>
            </section>
          </div>
        )}

        {tab === "leaderboard" && (
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Top Cats 🏆</h2>
            <p className="text-xs text-ink/50">Cycle {Number(cid)} · top 3 win $5 USDC each</p>
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => {
                const w = wallets[i];
                const s = scores[i] ? Number(scores[i]) : 0;
                const mine = address && w?.toLowerCase() === address.toLowerCase();
                const medal = ["🥇", "🥈", "🥉"][i];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ${
                      mine ? "bg-gold/30 ring-2 ring-gold" : "bg-white/70"
                    }`}
                  >
                    <span className="text-2xl">{medal}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {w && w !== "0x0000000000000000000000000000000000000000"
                          ? short(w)
                          : "— open —"}
                      </p>
                    </div>
                    <span className="font-display text-lg font-bold text-kitty">{s || "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl bg-white/60 p-4 text-sm text-ink/70">
              Prize pool: <b>$15 USDC</b> locked on-chain · {fmtTime(Number(timeLeft ?? 0))} left.
              Winners claim directly from the contract when the cycle ends.
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Your stats</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Best score" value={myBest !== undefined ? String(Number(myBest)) : "—"} />
              <Stat label="Rank" value={myRank >= 0 ? `#${myRank + 1}` : "Unranked"} />
              <Stat label="Cycle" value={`#${Number(cid)}`} />
              <Stat label="Status" value={myRank >= 0 ? "In the money 💰" : "Keep running"} />
            </div>
            <div className="mt-4 rounded-2xl bg-white/60 p-4 text-xs text-ink/60">
              {user?.username ? `@${user.username}` : "Guest"} · fid {user?.fid ?? "—"} ·{" "}
              {clientLabel || "web"}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[390px] items-center justify-around border-t border-black/5 bg-cream/90 py-2 backdrop-blur">
        {([
          ["play", "🐱", "Play"],
          ["leaderboard", "🏆", "Ranks"],
          ["profile", "👤", "Profile"],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-col items-center px-6 py-1 ${
              tab === t ? "text-kitty" : "text-ink/45"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span className="font-display text-xs font-semibold">{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
