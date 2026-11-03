import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        corporate: {
          navy: "#0B1F3A",
          teal: "#0F4C5C",
          charcoal: "#1F2933",
          offwhite: "#F7F5F0",
          softgrey: "#E5E7EB",
          border: "#E2E8F0",
        },
        status: {
          available: {
            bg: "#F0FDF4",
            text: "#15803D",
            border: "#BBF7D0",
            solid: "#16A34A",
          },
          occupied: {
            bg: "#FEF2F2",
            text: "#991B1B",
            border: "#FECACA",
            solid: "#DC2626",
          },
          unavailable: {
            bg: "#F8FAFC",
            text: "#475569",
            border: "#CBD5E1",
            solid: "#64748B",
          },
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
