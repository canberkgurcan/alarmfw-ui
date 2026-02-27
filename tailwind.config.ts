import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#1a1f2e",
        "sidebar-hover": "#252b3b",
      },
    },
  },
  plugins: [],
} satisfies Config;
