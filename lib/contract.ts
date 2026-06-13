// KattyPaws contract on Base mainnet (chainId 8453)
export const KATTY_PAWS_ADDRESS =
  "0x9F79E04c869232f5EAe2D8FB36180c02Ae8d966d" as const;

// PLAY_FEE = 0.000001 ETH expressed in wei (1e12)
export const PLAY_FEE = 1000000000000n;

// Minimal ABI — only what the frontend calls.
export const kattyPawsAbi = [
  {
    type: "function",
    name: "payToPlay",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "submitScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "score", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimPrize",
    stateMutability: "nonpayable",
    inputs: [{ name: "cid", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getTop",
    stateMutability: "view",
    inputs: [{ name: "cid", type: "uint256" }],
    outputs: [
      { name: "wallets", type: "address[3]" },
      { name: "scores", type: "uint256[3]" },
    ],
  },
  {
    type: "function",
    name: "cycleId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "timeLeft",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bestScore",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "cycleEnded",
    stateMutability: "view",
    inputs: [{ name: "cid", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Base Builder Code (bc_c5nmijk7) encoded as a calldata suffix. Appended to
// every transaction so the app gets attribution on Base. Trailing bytes are
// ignored by the contract's ABI decoder, so this is safe to attach.
export const BUILDER_SUFFIX =
  "0x62635f63356e6d696a6b370b0080218021802180218021802180218021" as const;

// ── Daily streak contract (deploy KattyDailyStreak.sol, paste address) ──
export const DAILY_STREAK_ADDRESS: `0x${string}` =
  "0x6aE99C3dE9fBF9f99D03D3E62997cBF63c6dFB3b";

export const dailyStreakAbi = [
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getStreak",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "currentStreak", type: "uint256" },
      { name: "lastCheckInDay", type: "uint256" },
      { name: "canCheckInToday", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "totalCheckIns",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// ── Skins contract (deploy KattySkins.sol, paste address) ──
export const KATTY_SKINS_ADDRESS: `0x${string}` =
  "0xAD41153aFaE674cccDcF7545b4854093AA4885c0";

export const kattySkinsAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "ownedMask",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "owns",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
