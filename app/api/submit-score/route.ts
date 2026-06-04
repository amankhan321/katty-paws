import { NextRequest, NextResponse } from "next/server";
import { keccak256, encodePacked, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { replay, scoreOf, createGame, step } from "@/lib/sim";

export const runtime = "nodejs";

// The validator's private key. MUST match the `scoreSigner` address set in the
// contract constructor. Set this in Vercel → Project → Settings → Environment
// Variables as SIGNER_PRIVATE_KEY (0x-prefixed). Never commit it.
const PK = process.env.SIGNER_PRIVATE_KEY as Hex | undefined;

export async function POST(req: NextRequest) {
  try {
    if (!PK) {
      return NextResponse.json({ error: "Signer not configured" }, { status: 500 });
    }
    const body = await req.json();
    const { walletAddress, seed, inputs, score, cycleId } = body ?? {};

    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: "Bad wallet" }, { status: 400 });
    }
    if (typeof seed !== "number" || !Array.isArray(inputs)) {
      return NextResponse.json({ error: "Bad run data" }, { status: 400 });
    }
    const claimed = Number(score);
    const cid = BigInt(cycleId);

    // Re-run the exact game from seed + jump ticks. This is the truth.
    const jumpTicks = inputs.map((n: unknown) => Number(n)).filter((n) => Number.isFinite(n));
    const serverScore = replay(seed, jumpTicks);

    // Sanity: the player can't claim more than the deterministic replay produced.
    if (claimed > serverScore) {
      return NextResponse.json(
        { error: "Score does not match replay", serverScore },
        { status: 400 }
      );
    }

    // Reject empty/instant runs.
    const probe = createGame(seed);
    const set = new Set(jumpTicks);
    while (probe.alive && probe.tick < 60000) step(probe, set.has(probe.tick + 1));
    if (probe.tick < 30 || serverScore <= 0) {
      return NextResponse.json({ error: "Run too short" }, { status: 400 });
    }

    const finalScore = BigInt(serverScore);
    const nonce = BigInt(Date.now());

    const digest = keccak256(
      encodePacked(
        ["address", "uint256", "uint256", "uint256"],
        [walletAddress as Hex, finalScore, cid, nonce]
      )
    );

    const account = privateKeyToAccount(PK);
    // EIP-191 personal_sign over the raw 32-byte digest — matches the contract's
    // toEthSignedMessageHash(...).recover(sig) check.
    const signature = await account.signMessage({ message: { raw: digest } });

    return NextResponse.json({
      score: serverScore,
      nonce: nonce.toString(),
      signature,
    });
  } catch (e) {
    return NextResponse.json({ error: "Validator error" }, { status: 500 });
  }
}
