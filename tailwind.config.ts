import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./client/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-cream": "#EAE7DA",
        "brand-navy": "#0B2130",
        "brand-orange": "#FA9223",
        "brand-turquoise": "#5CA4A4",
        "brand-coral": "#FFB4AD",
      },
      boxShadow: {
        brutal: "4px 4px 0px #0B2130",
        "brutal-lg": "6px 6px 0px #0B2130",
      },
    },
  },
  plugins: [],
};

export default config;

