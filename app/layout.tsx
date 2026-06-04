import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

// NOTE: replace the URL below with your real Vercel URL after first deploy,
// and replace the image with a 3:2 preview. The embed meta is what makes the
// app shareable as a Mini App card on Farcaster.
const APP_URL = "https://katty-paws.vercel.app";

const miniappEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/preview.png`,
  button: {
    title: "🐱 Play Katty Paws",
    action: {
      type: "launch_miniapp",
      name: "Katty Paws",
      url: APP_URL,
    },
  },
};

export const metadata: Metadata = {
  title: "Katty Paws",
  description: "Skill-based cat-runner on Base. Top 3 win USDC.",
  other: {
    "fc:miniapp": JSON.stringify(miniappEmbed),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
