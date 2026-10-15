/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef3ff",
          100: "#dfe8ff",
          200: "#c3d3fd",
          500: "#2f6bff",
          600: "#2456d6",
          700: "#1d46b0",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04)",
        pop: "0 8px 24px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
