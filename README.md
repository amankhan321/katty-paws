# Katty Paws 🐱

Skill-based cat-runner Mini App on Base. Pay a tiny fee to run, top 3 scores
each cycle win USDC. Winner selection is fully on-chain (see contracts/KattyPaws.sol).

## This commit = the shell
Wallet connect (Farcaster Mini App connector), splash handoff (`sdk.actions.ready()`),
profile, and the on-chain `payToPlay` call. The game itself comes next.

## Run locally
```
npm install
npm run dev
```

## Deploy
Push to GitHub → import into Vercel → deploy. After first deploy, replace the
`katty-paws.vercel.app` placeholder URLs in `app/layout.tsx` and
`public/.well-known/farcaster.json` with your real Vercel domain.

## Contract
Base mainnet: `0x9F79E04c869232f5EAe2D8FB36180c02Ae8d966d`
