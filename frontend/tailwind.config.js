/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#06923E",
          soft: "#e6f6ec",
        },
      },
    },
  },
  plugins: [],
};
