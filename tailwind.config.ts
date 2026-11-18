import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#07090f",
        midnight: "#0b0f19",
        panel: "#101624",
        card: "#141b2d",
        cardHover: "#192238",
        borderDark: "#1f2940",
        accentBlue: "#3b82f6",
        accentCyan: "#22d3ee",
        accentGreen: "#10b981",
        accentRed: "#ef4444",
        accentAmber: "#f59e0b",
        accentPurple: "#a855f7",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
