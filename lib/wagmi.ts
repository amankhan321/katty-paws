import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { injected } from "wagmi/connectors";

// Single source of truth for wallet + chain config.
// The Farcaster connector auto-connects to the user's wallet inside a
// Farcaster client (Base App / Warpcast). This is the correct connector
// for Mini Apps — do NOT swap in ConnectKit/RainbowKit here.
export const config = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [miniAppConnector(), injected()],
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
