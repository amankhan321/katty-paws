import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF5E4",
        peach: "#FFE4C4",
        kitty: "#F97316",
        gold: "#F59E0B",
        ink: "#1C1C1E",
      },
      fontFamily: {
        display: ["Fredoka", "system-ui", "sans-serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
