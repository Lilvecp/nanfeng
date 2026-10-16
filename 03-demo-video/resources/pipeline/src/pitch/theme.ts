// One theme for the pitch cut: the NanFeng brand (src/brand.tsx) plus the motion vocabulary every
// component uses. No component inlines a colour, an easing or a spring.
import { Easing } from "remotion";
import { C, F } from "../brand";

export const theme = {
  colors: {
    ...C,
    coral: "#EE6A80", // the sail's red: danger, the one thing that went wrong
    sky: "#7FB3D5",
    mist: "#C9D6F0",
    zh: "#E6D3A6", // Chinese lines under the English ones
    green: "#8FCBA3",
    card: "rgba(20,34,61,0.78)",
    cardLine: "rgba(255,255,255,0.10)",
    glow: "rgba(201,168,102,0.38)",
  },
  fonts: F,
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1), // entrances
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // moves, slow pushes
    in: Easing.bezier(0.7, 0, 0.84, 0), // exits only
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 }, // words, chips
    smooth: { damping: 20, stiffness: 90, mass: 1 }, // cards, big blocks
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 }, // the logo
    count: { damping: 30, stiffness: 60, mass: 1 }, // counters
  },
  // frames, at 30 fps
  t: { stagger: 4, words: 3, exit: 9, dipOut: 5, dipIn: 8 },
  sfx: { whoosh: 0.2, pop: 0.22, tick: 0.12 },
} as const;
