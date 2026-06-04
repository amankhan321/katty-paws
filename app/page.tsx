"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { KATTY_PAWS_ADDRESS, PLAY_FEE, kattyPawsAbi } from "@/lib/contract";
import Game, { type GameResult } from "./Game";

type FcUser = { fid?: number; username?: string; pfpUrl?: string };
type Phase = "home" | "playing" | "over";

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<FcUser | null>(null);
  const [phase, setPhase] = useState<Phase>("home");
  const [lastScore, setLastScore] = useState(0);
  const [best, setBest] = useState(0);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Boot SDK + drop splash
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
        /* outside a Farcaster client */
      } finally {
        if (alive) setBooted(true);
      }
    })();
    try {
      const b = Number(localStorage.getItem("kp_best") || "0");
      if (!Number.isNaN(b)) setBest(b);
    } catch {}
    return () => {
      alive = false;
    };
  }, []);

  // When the play fee confirms, start the run.
  useEffect(() => {
    if (isSuccess) {
      setPhase("playing");
      reset();
    }
  }, [isSuccess, reset]);

  function pay() {
    reset();
    writeContract({
      address: KATTY_PAWS_ADDRESS,
      abi: kattyPawsAbi,
      functionName: "payToPlay",
      value: PLAY_FEE,
    });
  }

  const handleGameOver = useCallback((r: GameResult) => {
    setLastScore(r.score);
    setBest((prev) => {
      const next = Math.max(prev, r.score);
      try {
        localStorage.setItem("kp_best", String(next));
      } catch {}
      return next;
    });
    setPhase("over");
  }, []);

  if (!booted) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-bob text-6xl">🐱</div>
      </main>
    );
  }

  if (phase === "playing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col items-center justify-center px-4 py-6">
        <Game onGameOver={handleGameOver} />
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
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold text-ink">
            {user?.username ? `@${user.username}` : "Guest cat"}
          </p>
          <p className="truncate text-xs text-ink/60">
            {isConnected && address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Wallet not connected"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold text-kitty">{best}</p>
          <p className="text-[10px] text-ink/50">best</p>
        </div>
      </section>

      <section className="mt-8 flex flex-1 flex-col items-center justify-center">
        <div className="animate-bob select-none text-[120px] leading-none">🐈</div>
        {phase === "over" ? (
          <div className="animate-pop mt-2 text-center">
            <p className="font-display text-2xl font-bold text-ink">Run over!</p>
            <p className="mt-1 font-display text-5xl font-bold text-kitty">
              {lastScore}
            </p>
            <p className="text-sm text-ink/60">best {best}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 font-display text-xl font-semibold text-ink/80">
              Ready to run?
            </p>
            <p className="mt-1 text-center text-sm text-ink/60">
              Pay a tiny fee to start. Top 3 scores this cycle win USDC.
            </p>
          </>
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
            onClick={pay}
            disabled={isPending || confirming}
            className="w-full rounded-2xl bg-kitty py-4 font-display text-lg font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            {isPending
              ? "Confirm in wallet…"
              : confirming
              ? "Starting on Base…"
              : phase === "over"
              ? "Play Again 🐾"
              : "Play Now 🐾"}
          </button>
        )}
        {writeError && (
          <p className="mt-3 text-center text-sm text-red-600">
            Transaction needed to play 🐾
          </p>
        )}
        <p className="mt-3 text-center text-[11px] text-ink/50">
          ~$0.003 play fee on Base · powered by player fees 🐱
        </p>
      </section>
    </main>
  );
}
