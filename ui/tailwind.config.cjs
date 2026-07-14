/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // on active le dark‑mode via la classe "dark"
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette “tech / geek” (bleu nuit + gris anthracite)
        "tech-bg": "#0d1117",
        "tech-primary": "#1e40af",
        "tech-muted": "#64748b",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
