// Cosmetic cat skins. `colors` drives the in-game cat; price/meta drive the UI.
// priceWei MUST match priceOf() in contracts/KattySkins.sol.

export type SkinColors = {
  body: string;
  dark: string;
  stripe: string;
  pink: string;
  belly: string;
};

export type Skin = {
  id: number;
  name: string;
  rarity: string;
  priceLabel: string;
  priceWei: bigint;
  colors: SkinColors;
};

export const SKINS: Skin[] = [
  {
    id: 0,
    name: "Classic",
    rarity: "Starter",
    priceLabel: "Free",
    priceWei: 0n,
    colors: { body: "#F97316", dark: "#E2670F", stripe: "#C2540C", pink: "#FCA5A5", belly: "#FFD9B0" },
  },
  {
    id: 1,
    name: "Tuxedo",
    rarity: "Common",
    priceLabel: "0.00002 ETH",
    priceWei: 20000000000000n,
    colors: { body: "#2D2D33", dark: "#18181C", stripe: "#0E0E12", pink: "#E8A0A0", belly: "#FFFFFF" },
  },
  {
    id: 2,
    name: "Gray Tabby",
    rarity: "Common",
    priceLabel: "0.00003 ETH",
    priceWei: 30000000000000n,
    colors: { body: "#9AA3AD", dark: "#6E767F", stripe: "#525A62", pink: "#E0A0A0", belly: "#EEF1F3" },
  },
  {
    id: 3,
    name: "Calico",
    rarity: "Rare",
    priceLabel: "0.00004 ETH",
    priceWei: 40000000000000n,
    colors: { body: "#F0E2CC", dark: "#C99A5B", stripe: "#D98A2B", pink: "#F0A0A0", belly: "#FFFFFF" },
  },
  {
    id: 4,
    name: "Shadow",
    rarity: "Epic",
    priceLabel: "0.00006 ETH",
    priceWei: 60000000000000n,
    colors: { body: "#262B3D", dark: "#161A28", stripe: "#0F1320", pink: "#8B6CFF", belly: "#353C57" },
  },
  {
    id: 5,
    name: "Golden",
    rarity: "Legendary",
    priceLabel: "0.0001 ETH",
    priceWei: 100000000000000n,
    colors: { body: "#F6C453", dark: "#D99A2E", stripe: "#B97E1E", pink: "#F4A0A0", belly: "#FFF1C2" },
  },
];

export function skinColors(id: number): SkinColors {
  return (SKINS.find((s) => s.id === id) ?? SKINS[0]).colors;
}
