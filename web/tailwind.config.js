/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // oeradio.at brand palette
        ink: "#0f172a", // dark slate (header / headings)
        ink2: "#1e293b",
        brand: {
          DEFAULT: "#d8613c", // terracotta accent
          dark: "#bf5230",
          light: "#e6815f",
        },
        sand: "#c2a990",
        sage: "#b1c5a4",
        // keep `funk` as alias -> terracotta so existing references re-skin
        funk: { 600: "#d8613c", 700: "#bf5230" },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.18)",
        btn: "0 6px 16px -6px rgba(216,97,60,.55)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.1rem",
      },
    },
  },
  plugins: [],
};
