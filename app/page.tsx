"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  KATTY_PAWS_ADDRESS,
  PLAY_FEE,
  BUILDER_SUFFIX,
  kattyPawsAbi,
  DAILY_STREAK_ADDRESS,
  dailyStreakAbi,
  KATTY_SKINS_ADDRESS,
  kattySkinsAbi,
} from "@/lib/contract";
import GameCanvas, { type RunResult } from "./GameCanvas";
import { SKINS, skinColors } from "@/lib/skins";

type Screen = "home" | "playing" | "over";
type Tab = "play" | "daily" | "skins" | "leaderboard" | "profile";
const ZERO = "0x0000000000000000000000000000000000000000";
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
  const [inHost, setInHost] = useState(false);
  const [forcePlay, setForcePlay] = useState(false);
  const [showHype, setShowHype] = useState(true);
  const [user, setUser] = useState<FcUser | null>(null);
  const [clientLabel, setClientLabel] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<Tab>("play");
  const [run, setRun] = useState<RunResult | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string>("");
  const [notNewBest, setNotNewBest] = useState(false);

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
  const { data: myBest, refetch: refetchBest } = useReadContract({
    address: KATTY_PAWS_ADDRESS,
    abi: kattyPawsAbi,
    functionName: "bestScore",
    args: [cid, (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
    query: { enabled: !!address },
  });

  const { data: streakData, refetch: refetchStreak } = useReadContract({
    address: DAILY_STREAK_ADDRESS,
    abi: dailyStreakAbi,
    functionName: "getStreak",
    args: [(address ?? ZERO) as `0x${string}`],
    query: { enabled: !!address && DAILY_STREAK_ADDRESS !== ZERO },
  });
  const chk = useWriteContract();
  const chkRcpt = useWaitForTransactionReceipt({ hash: chk.data });

  const [equipped, setEquipped] = useState(0);
  useEffect(() => {
    const e =
      typeof window !== "undefined" ? window.localStorage.getItem("katty_skin") : null;
    if (e != null) setEquipped(Number(e) || 0);
  }, []);
  const { data: skinMask, refetch: refetchSkins } = useReadContract({
    address: KATTY_SKINS_ADDRESS,
    abi: kattySkinsAbi,
    functionName: "ownedMask",
    args: [(address ?? ZERO) as `0x${string}`],
    query: { enabled: !!address && KATTY_SKINS_ADDRESS !== ZERO },
  });
  const mintSkin = useWriteContract();
  const mintRcpt = useWaitForTransactionReceipt({ hash: mintSkin.data });
  useEffect(() => {
    if (mintRcpt.isSuccess) refetchSkins();
  }, [mintRcpt.isSuccess, refetchSkins]);

  const ownsSkin = useCallback(
    (id: number) => {
      if (id === 0) return true;
      const m = skinMask ? (skinMask as bigint) : 0n;
      return ((m >> BigInt(id)) & 1n) === 1n;
    },
    [skinMask]
  );
  const equip = useCallback((id: number) => {
    setEquipped(id);
    try {
      window.localStorage.setItem("katty_skin", String(id));
    } catch {}
  }, []);
  const doMint = useCallback(
    (id: number, priceWei: bigint) => {
      mintSkin.writeContract({
        address: KATTY_SKINS_ADDRESS,
        abi: kattySkinsAbi,
        functionName: "mint",
        args: [BigInt(id)],
        value: priceWei,
        dataSuffix: BUILDER_SUFFIX,
      });
    },
    [mintSkin]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        // Official host detection — true inside ANY Farcaster host (Base App, Warpcast…)
        let inMini = false;
        try {
          inMini = await sdk.isInMiniApp();
        } catch {}
        let ctx: any = null;
        try {
          ctx = await Promise.race([
            sdk.context,
            new Promise((r) => setTimeout(() => r(null), 2000)),
          ]);
        } catch {}
        const host = inMini || !!(ctx?.user || ctx?.client);
        if (alive) setInHost(host);
        if (alive && ctx?.user) {
          setUser({ fid: ctx.user.fid, username: ctx.user.username, pfpUrl: ctx.user.pfpUrl });
        }
        const cf = ctx?.client?.clientFid;
        if (cf === 309857) setClientLabel("Base App");
        else if (cf) setClientLabel("Farcaster");
        sdk.actions.ready().catch(() => {});
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
    if (subRcpt.isSuccess) {
      setSubmitMsg("Saved on-chain ✅");
      refetchBest();
    }
  }, [subRcpt.isSuccess, refetchBest]);

  useEffect(() => {
    if (chkRcpt.isSuccess) refetchStreak();
  }, [chkRcpt.isSuccess, refetchStreak]);

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

  const connectWallet = useCallback(() => {
    const inj = connectors.find((c) => c.id === "injected");
    connect({ connector: inHost ? connectors[0] : inj ?? connectors[0] });
  }, [connect, connectors, inHost]);

  const doCheckIn = useCallback(() => {
    chk.writeContract({
      address: DAILY_STREAK_ADDRESS,
      abi: dailyStreakAbi,
      functionName: "checkIn",
      dataSuffix: BUILDER_SUFFIX,
    });
  }, [chk]);

  const effectiveSkin = ownsSkin(equipped) ? equipped : 0;

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
    // Only a higher score can save — block low submissions before any tx/revert.
    let prevBest = Number(myBest ?? 0n);
    try {
      const r = await refetchBest();
      if (r.data !== undefined) prevBest = Number(r.data);
    } catch {}
    if (run.score <= prevBest) {
      setNotNewBest(true);
      return;
    }
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
  }, [run, address, cid, sub, refetchBest, myBest]);

  if (!booted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-bob text-6xl">🐱</div>
      </main>
    );
  }

  // ---------- LAUNCH SCREEN (plain browser, not inside a host) ----------
  if (!inHost && !forcePlay) {
    const APP = "https://katty-paws-u4ng.vercel.app";
    const baseLink = `cbwallet://miniapp?url=${APP}`;
    const fcLink =
      "https://farcaster.xyz/~/mini-apps/launch?domain=katty-paws-u4ng.vercel.app";
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col items-center justify-center px-6 text-center">
        <div className="animate-bob text-[120px] leading-none">🐈</div>
        <h1 className="mt-2 font-display text-4xl font-bold text-kitty">Katty Paws</h1>
        <p className="mt-2 text-ink/70">A cat-runner on Base. Top 3 each cycle win USDC.</p>
        <p className="mt-1 text-sm text-ink/50">Best played inside the Base App or Farcaster.</p>
        <a
          href={baseLink}
          className="mt-8 w-full rounded-2xl bg-[#0052FF] py-4 font-display text-lg font-bold text-white shadow-md active:scale-[0.98]"
        >
          Open in Base App
        </a>
        <a
          href={fcLink}
          className="mt-3 w-full rounded-2xl bg-[#7C65C1] py-4 font-display text-lg font-bold text-white shadow-md active:scale-[0.98]"
        >
          Open in Farcaster
        </a>
        <button
          onClick={() => setForcePlay(true)}
          className="mt-3 w-full rounded-2xl bg-white/70 py-3 font-display text-base font-semibold text-ink/80 shadow active:scale-[0.98]"
        >
          Play in this browser →
        </button>
        <p className="mt-6 text-xs text-ink/40">
          Tip: posting the link as a cast opens it as a tappable game card.
        </p>
      </main>
    );
  }

  // ---------- PLAYING ----------
  if (screen === "playing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center px-3">
        <p className="mb-2 text-center text-sm text-ink/60">Tap to jump · tap twice to clear birds</p>
        <GameCanvas onGameOver={onGameOver} skin={skinColors(effectiveSkin)} />
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
        {notNewBest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
            <div className="animate-pop w-full max-w-[320px] rounded-3xl bg-white p-6 text-center shadow-xl">
              <div className="text-5xl">🙀</div>
              <h3 className="mt-2 font-display text-xl font-bold text-ink">Not a new best yet</h3>
              <p className="mt-2 text-sm text-ink/70">
                Your best this cycle is <b>{Number(myBest ?? 0)}</b>. Only a higher score
                saves to the leaderboard — beat it, then submit!
              </p>
              <button
                onClick={() => setNotNewBest(false)}
                className="mt-5 w-full rounded-2xl bg-kitty py-3 font-display font-bold text-white active:scale-[0.98]"
              >
                Got it 🐾
              </button>
            </div>
          </div>
        )}
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
                  onClick={connectWallet}
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

        {tab === "daily" && (
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Daily Streak 🔥</h2>
            <p className="text-xs text-ink/50">Check in every day. Miss a day and it resets.</p>

            <div className="mt-4 rounded-3xl bg-gradient-to-b from-kitty to-gold p-6 text-center text-white shadow-md">
              <div className="text-5xl">🔥</div>
              <p className="mt-1 font-display text-5xl font-bold">
                {streakData ? Number(streakData[0]) : 0}
              </p>
              <p className="text-sm font-semibold text-white/90">day streak</p>
            </div>

            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const cur = streakData ? Number(streakData[0]) : 0;
                const on = cur > 0 && (((cur - 1) % 7) + 1) >= d;
                return (
                  <div
                    key={d}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      on ? "bg-gold text-white" : "bg-white/70 text-ink/30"
                    }`}
                  >
                    {on ? "🔥" : d}
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              {DAILY_STREAK_ADDRESS === ZERO ? (
                <p className="rounded-2xl bg-white/70 p-4 text-center text-sm text-ink/60">
                  Daily check-in goes live once the streak contract is deployed.
                </p>
              ) : !isConnected ? (
                <button
                  onClick={connectWallet}
                  className="w-full rounded-2xl bg-ink py-4 font-display text-lg font-semibold text-white shadow-md active:scale-[0.98]"
                >
                  Connect Wallet
                </button>
              ) : streakData && !streakData[2] ? (
                <div className="rounded-2xl bg-white/70 p-4 text-center">
                  <p className="font-display font-bold text-ink">Checked in today ✅</p>
                  <p className="mt-1 text-sm text-ink/60">Come back tomorrow 🌙 (resets at UTC midnight)</p>
                </div>
              ) : (
                <button
                  onClick={doCheckIn}
                  disabled={chk.isPending || chkRcpt.isLoading}
                  className="w-full rounded-2xl bg-kitty py-4 font-display text-lg font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {chk.isPending
                    ? "Confirm in wallet…"
                    : chkRcpt.isLoading
                    ? "Checking in…"
                    : "Check in today 🔥"}
                </button>
              )}
              {chk.error && (
                <p className="mt-2 text-center text-sm text-red-600">Couldn’t check in — try again</p>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-white/60 p-4 text-xs text-ink/60">
              Keep your streak alive to unlock cat skins soon. Free — you only pay gas.
            </div>
          </div>
        )}

        {tab === "skins" && (
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Cat Skins 🎨</h2>
            <p className="text-xs text-ink/50">
              Unlock cosmetic skins on-chain and equip one to change your runner. Classic is free.
            </p>
            {KATTY_SKINS_ADDRESS === ZERO && (
              <p className="mt-3 rounded-2xl bg-white/70 p-3 text-center text-sm text-ink/60">
                Minting goes live once the skins contract is deployed.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {SKINS.map((sknn) => {
                const owned = ownsSkin(sknn.id);
                const isEquipped = effectiveSkin === sknn.id;
                return (
                  <div key={sknn.id} className="rounded-2xl bg-white/70 p-3 text-center shadow-sm">
                    <div className="flex justify-center">
                      <SkinPreview c={sknn.colors} />
                    </div>
                    <p className="mt-1 font-display text-sm font-bold text-ink">{sknn.name}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                      {sknn.rarity}
                    </p>
                    {owned ? (
                      isEquipped ? (
                        <div className="mt-2 rounded-xl bg-kitty py-2 text-xs font-bold text-white">
                          Equipped ✓
                        </div>
                      ) : (
                        <button
                          onClick={() => equip(sknn.id)}
                          className="mt-2 w-full rounded-xl bg-ink py-2 text-xs font-bold text-white active:scale-[0.98]"
                        >
                          Equip
                        </button>
                      )
                    ) : !isConnected ? (
                      <button
                        onClick={connectWallet}
                        className="mt-2 w-full rounded-xl bg-ink/80 py-2 text-xs font-bold text-white"
                      >
                        Connect
                      </button>
                    ) : (
                      <button
                        onClick={() => doMint(sknn.id, sknn.priceWei)}
                        disabled={
                          KATTY_SKINS_ADDRESS === ZERO ||
                          mintSkin.isPending ||
                          mintRcpt.isLoading
                        }
                        className="mt-2 w-full rounded-xl bg-gold py-2 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-60"
                      >
                        Mint · {sknn.priceLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {mintSkin.error && (
              <p className="mt-2 text-center text-sm text-red-600">Mint failed — try again</p>
            )}
            <p className="mt-3 text-center text-[11px] text-ink/40">
              Skins are cosmetic on-chain unlocks (not tradeable). Each mint carries the builder code.
            </p>
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
          ["daily", "🔥", "Daily"],
          ["skins", "🎨", "Skins"],
          ["leaderboard", "🏆", "Ranks"],
          ["profile", "👤", "Profile"],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-col items-center px-2.5 py-1 ${
              tab === t ? "text-kitty" : "text-ink/45"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span className="font-display text-xs font-semibold">{label}</span>
          </button>
        ))}
      </nav>

      {showHype && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 px-6">
          <SideFire />
          <div className="animate-pop relative z-10 w-full max-w-[330px] overflow-hidden rounded-3xl bg-gradient-to-b from-gold via-kitty to-[#EA580C] p-6 text-center shadow-2xl">
            <button
              onClick={() => setShowHype(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-lg font-bold text-white active:scale-90"
            >
              ✕
            </button>
            <div className="text-3xl">✨🏆✨</div>
            <p className="mt-2 font-display text-sm font-bold uppercase tracking-widest text-white/80">
              Prize Pool Live
            </p>
            <h2 className="mt-1 font-display text-4xl font-bold text-white drop-shadow">
              $15 USDC
            </h2>
            <p className="mt-2 font-display text-lg font-semibold text-white">
              Top 3 runners win <span className="underline">$5 each</span>
            </p>
            <div className="mt-4 rounded-2xl bg-white/20 px-4 py-2 text-sm font-semibold text-white">
              🔒 Locked on-chain · {fmtTime(Number(timeLeft ?? 0))} left
            </div>
            <button
              onClick={() => setShowHype(false)}
              className="mt-5 w-full rounded-2xl bg-white py-3 font-display text-lg font-bold text-kitty shadow active:scale-[0.98]"
            >
              Let's run! 🐾
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function SkinPreview({
  c,
}: {
  c: { body: string; dark: string; stripe: string; pink: string; belly: string };
}) {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16">
      <path d="M14 40 Q6 30 12 22" stroke={c.body} strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="34" cy="40" rx="18" ry="13" fill={c.body} />
      <ellipse cx="34" cy="44" rx="11" ry="7" fill={c.belly} />
      <path d="M30 30 L28 50 M37 29 L35 51 M44 31 L43 49" stroke={c.stripe} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="28" r="12" fill={c.body} />
      <path d="M38 20 L36 9 L46 17 Z" fill={c.body} />
      <path d="M54 20 L56 9 L46 17 Z" fill={c.body} />
      <path d="M40 18 L39 12 L45 16 Z" fill={c.pink} />
      <path d="M52 18 L53 12 L47 16 Z" fill={c.pink} />
      <circle cx="51" cy="30" r="4.5" fill={c.belly} />
      <circle cx="48" cy="27" r="2" fill="#1C1C1E" />
      <circle cx="48.6" cy="26.2" r="0.7" fill="#fff" />
      <path d="M53 30 L57 29 L55 33 Z" fill={c.pink} />
    </svg>
  );
}

function SideFire() {
  const colors = ["#F59E0B", "#F97316", "#FFD9B0", "#FCA5A5", "#ffffff", "#EA580C", "#FDE68A"];
  const pieces = Array.from({ length: 34 }).map((_, i) => {
    const side = i % 2 === 0 ? "left" : "right";
    const idx = Math.floor(i / 2);
    const spread = idx / 17; // 0..1
    const tx = (side === "left" ? 1 : -1) * (30 + spread * 300); // shoot inward/across
    const ty = -(240 + ((idx * 57) % 260)); // shoot UP
    const style: any = {
      bottom: "14%",
      "--tx": `${tx.toFixed(0)}px`,
      "--ty": `${ty.toFixed(0)}px`,
      "--rot": `${(i * 61) % 360}deg`,
      background: colors[i % colors.length],
      animationDelay: `${(i % 8) * 0.1}s`,
      animationDuration: `${(1.4 + (i % 5) * 0.18).toFixed(2)}s`,
    };
    style[side] = `${6 + (idx % 4) * 7}px`;
    return <span key={i} className="confetti-piece" style={style} />;
  });
  return <>{pieces}</>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
    </div>
  );
}
