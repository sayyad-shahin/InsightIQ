/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          50: "hsl(222 100% 97%)",
          100: "hsl(222 96% 93%)",
          200: "hsl(222 95% 87%)",
          300: "hsl(223 90% 78%)",
          400: "hsl(224 84% 68%)",
          500: "hsl(226 74% 58%)",
          600: "hsl(228 70% 50%)",
          700: "hsl(230 66% 43%)",
          800: "hsl(230 60% 36%)",
          900: "hsl(230 52% 30%)",
        },
      },
      borderRadius: {
        "2xl": "1.25rem",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px hsl(var(--foreground) / 0.04), 0 4px 16px hsl(var(--foreground) / 0.06)",
        "soft-lg": "0 2px 8px hsl(var(--foreground) / 0.06), 0 16px 40px hsl(var(--foreground) / 0.10)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.15), 0 8px 32px hsl(var(--primary) / 0.28)",
        "inner-top": "inset 0 1px 0 0 hsl(var(--foreground) / 0.05)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, hsl(226 74% 58%), hsl(266 78% 62%))",
        "brand-gradient-soft": "linear-gradient(135deg, hsl(226 74% 58% / 0.14), hsl(266 78% 62% / 0.14))",
        "mesh": "radial-gradient(at 0% 0%, hsl(226 74% 58% / 0.18) 0px, transparent 50%), radial-gradient(at 100% 0%, hsl(266 78% 62% / 0.16) 0px, transparent 50%), radial-gradient(at 100% 100%, hsl(190 90% 55% / 0.12) 0px, transparent 50%)",
        "grid": "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s infinite",
        "gradient-pan": "gradient-pan 6s ease infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
