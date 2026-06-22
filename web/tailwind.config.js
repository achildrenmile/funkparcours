/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // OE Radio Tools family palette (matches xotamap.oeradio.at)
        ink: "#1f2937", // gray-800 header / headings
        ink2: "#111827", // gray-900
        brand: {
          DEFAULT: "#2563eb", // blue-600 (xotamap accent)
          dark: "#1d4ed8", // blue-700
          light: "#60a5fa", // blue-400
        },
        sand: "#c2a990",
        sage: "#b1c5a4",
        // keep `funk` as alias -> brand blue so existing references re-skin
        funk: { 600: "#2563eb", 700: "#1d4ed8" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.18)",
        btn: "0 6px 16px -6px rgba(37,99,235,.5)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.1rem",
      },
    },
  },
  plugins: [],
};
