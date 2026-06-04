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
] as const;
