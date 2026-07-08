/** Sealed Sphere of Light constants — identity preservation law. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#06060A",
        raise: "#12100B",
        gold: "#C5A55A",
        parchment: "#F3EAD3",
        vellum: "#A69274",
        leather: "#2A1F14",
      },
      fontFamily: {
        label: ["Cinzel", "serif"],
        heading: ["'Cormorant Garamond'", "serif"],
        body: ["'EB Garamond'", "serif"],
      },
      letterSpacing: { rite: ".32em", seal: ".18em" },
    },
  },
  plugins: [],
};
