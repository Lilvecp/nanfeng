// The pitch timeline written by `node pitch.mjs --write` (src/pitch.json), with its types.
import type { Focus } from "../zoom";
import pitch from "../pitch.json";

export type PLine = { clip: string; start: number; end: number; en: string; zh: string; audio: string; lead: number };
export type Piece = { from: number; to: number; rate: number; at: number; join: "cut" | "dip" };
export type Section = {
  id: string; kind: "card" | "mg" | "shot"; start: number; dur: number; chapter: number; chapterStart: boolean;
  chips: ("TC" | "SC" | "II" | "ON")[]; caption: { en: string; zh: string } | null; lines: PLine[];
  card?: "Opening" | "EndCard"; mg?: "Problem" | "Results" | "Team";
  // shots
  scene?: string; join?: "cut" | "dip"; pieces?: Piece[]; video?: string; clip?: number;
  focus?: Focus[]; marks?: { name: string; t: number }[]; speed?: { t: number; rate: number }[]; notes?: Record<string, string | number>;
};
export type Chapter = { id: string; en: string; zh: string };

export const FPS = 30;
export const SECTIONS = pitch.sections as unknown as Section[];
export const CHAPTERS = pitch.chapters as Chapter[];
export const TOTAL = pitch.total;

/** First and last frame of a section on the cut's clock (rounded once, so sections tile exactly). */
export const startFrame = (s: Section) => Math.round(s.start * FPS);
export const sectionFrames = (s: Section) => Math.round((s.start + s.dur) * FPS) - startFrame(s);
export const totalFrames = () => Math.round(TOTAL * FPS);
