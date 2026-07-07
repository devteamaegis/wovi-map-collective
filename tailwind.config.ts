import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--paper)",
          2: "var(--paper-2)",
          3: "var(--paper-3)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        rule: "var(--rule)",
        navy: {
          DEFAULT: "var(--navy)",
          2: "var(--navy-2)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          pale: "var(--accent-pale)",
        },
        warn: "var(--warn)",
        good: "var(--good)",
        "good-text": "var(--good-text)", // AA green for text on light-green tints
        danger: "var(--danger)", // resolves text-danger / hover:text-danger (previously undefined → no-op)
        surface: "var(--surface)",
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderColor: {
        DEFAULT: "var(--rule)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 26, 36, 0.04), 0 1px 1px rgba(19, 26, 36, 0.03)",
        panel: "0 8px 30px rgba(19, 26, 36, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
