/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mts: {
          primary: "#B91C1C",
          primaryDark: "#991616",
          accent: "#D4AF37",
          ink: "#1F1F1F",
          paper: "#FFFFFF",
          soft: "#F9F9F9"
        }
      },
      boxShadow: {
        mts: "0 4px 12px rgba(0, 0, 0, 0.1)"
      }
    }
  },
  plugins: []
};
