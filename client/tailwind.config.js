/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      // Palette institutionnelle ("bleu marine") : couleur structurante de la
      // charte (bandeaux, navigation active, boutons d'action principaux),
      // en remplacement de l'ancien violet utilisé comme accent de marque —
      // inspirée des chartes des portails de service public (sobriété,
      // contraste), sans reprendre d'éléments d'identité officielle de
      // l'État (voir server/src/pdfSynthese.js pour la même réserve sur le
      // PDF : le pôle n'est pas un service de l'État).
      colors: {
        marine: {
          50: "#eef2f8",
          100: "#dbe4f0",
          200: "#b7c9e1",
          300: "#8fa9cd",
          400: "#5f80ae",
          500: "#3d5f8f",
          600: "#2c4770",
          700: "#1f3557",
          800: "#152540",
          900: "#0e1a2e",
          950: "#0a1220",
        },
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
