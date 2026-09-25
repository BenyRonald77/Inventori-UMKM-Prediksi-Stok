import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#ea580c",
          600: "#c2410c",
          700: "#9a3412",
          900: "#7c2d12",
        },
      },
    },
  },
  plugins: [],
};

export default config;
