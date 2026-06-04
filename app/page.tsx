"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { KATTY_PAWS_ADDRESS, PLAY_FEE, kattyPawsAbi } from "@/lib/contract";
import GameCanvas, { type RunResult } from "./GameCanvas";

type Screen = "home" | "playing" | "over";
type FcUser = { fid?: number; username?: string; pfpUrl?: string };

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<FcUser | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const ctx: any = await sdk.context;
        if (alive && ctx?.user) {
          setUser({
            fid: ctx.user.fid,
            username: ctx.user.username,
            pfpUrl: ctx.user.pfpUrl,
          });
        }
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

  const startPay = useCallback(() => {
    setSubmitMsg("");
    pay.reset();
    pay.writeContract({
      address: KATTY_PAWS_ADDRESS,
      abi: kattyPawsAbi,
      functionName: "payToPlay",
      value: PLAY_FEE,
    });
  }, [pay]);

  const onGameOver = useCallback((r: RunResult) => {
    setRun(r);
    setScreen("over");
  }, []);

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
          cycleId: cycleId ? Number(cycleId) : 1,
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
        args: [BigInt(data.score), BigInt(data.nonce), data.signature as `0x${string}`],
      });
    } catch {
      setSubmitMsg("Network error — try again");
    }
  }, [run, address, cycleId, sub]);

  useEffect(() => {
    if (subRcpt.isSuccess) setSubmitMsg("Saved on-chain ✅");
  }, [subRcpt.isSuccess]);

  if (!booted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-bob text-6xl">🐱</div>
      </main>
    );
  }

  if (screen === "playing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center px-3">
        <p className="mb-2 text-center text-sm text-ink/60">
          Tap to jump · tap twice to clear birds
        </p>
        <GameCanvas onGameOver={onGameOver} />
      </main>
    );
  }

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
            onClick={startPay}
            disabled={pay.isPending || payRcpt.isLoading}
            className="mt-3 w-full rounded-2xl bg-kitty py-3 font-display text-lg font-bold text-white shadow active:scale-[0.98] disabled:opacity-60"
          >
            {pay.isPending || payRcpt.isLoading ? "Starting…" : "Play again 🐾"}
          </button>

          {submitMsg && <p className="mt-3 text-sm text-ink/70">{submitMsg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-kitty">Katty Paws</h1>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-ink shadow-sm">
          Base
        </span>
      </header>

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
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {user?.username ? `@${user.username}` : "Guest cat"}
          </p>
          <p className="truncate text-xs text-ink/60">
            {isConnected && address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Wallet not connected"}
          </p>
        </div>
      </section>

      <section className="mt-8 flex flex-1 flex-col items-center justify-center">
        <div className="animate-bob select-none text-[120px] leading-none">🐈</div>
        <p className="mt-2 font-display text-xl font-semibold text-ink/80">Ready to run?</p>
        <p className="mt-1 text-center text-sm text-ink/60">
          Pay a tiny fee to start a run. Top 3 scores this cycle win USDC.
        </p>
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
            className="w-full rounded-2xl bg-kitty py-4 font-display text-lg font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            {pay.isPending
              ? "Confirm in wallet…"
              : payRcpt.isLoading
              ? "Starting on Base…"
              : "Play Now 🐾"}
          </button>
        )}
        {pay.error && (
          <p className="mt-3 text-center text-sm text-red-600">Transaction needed to play 🐾</p>
        )}
        <p className="mt-3 text-center text-[11px] text-ink/50">
          ~$0.003 play fee on Base · powered by player fees 🐱
        </p>
      </section>
    </main>
  );
}
