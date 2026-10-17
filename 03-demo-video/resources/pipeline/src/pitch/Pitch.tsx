// The 3-minute pitch cut (deliverable 03): pitch.mjs decides what plays when; this lays it out.
// Layers, bottom to top: moving background, grain and vignette → the section (an app shot on its
// screen frame, or a motion-graphics scene with its own grade and grain) → the rail, chips and
// subtitles. The narration plays on the cut's clock, one clip per line, over the music bed
// (tts/music.py: written for this timeline, already ducked under every line; REMOTION_MUSIC=0 mutes it).
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { EndCard, Opening } from "./Cards";
import { SECTIONS, sectionFrames, startFrame, type Section } from "./data";
import { BgMesh, Grain, Vignette } from "./fx";
import { Chips, Rail, Source, Subtitles } from "./Overlay";
import { Problem } from "./Problem";
import { Results } from "./Results";
import { Shot } from "./Shot";
import { Team } from "./Team";

function Body({ s, k }: { s: Section; k: number }) {
  const prev = SECTIONS[k - 1], next = SECTIONS[k + 1];
  if (s.kind === "shot") return <Shot s={s} prev={prev} next={next} />;
  if (s.card === "Opening") return <Opening s={s} />;
  if (s.card === "EndCard") return <EndCard s={s} />;
  if (s.mg === "Problem") return <Problem s={s} />;
  if (s.mg === "Results") return <Results s={s} />;
  if (s.mg === "Team") return <Team s={s} />;
  return null;
}

export function Pitch() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <BgMesh />
      <Grain opacity={0.04} />
      <Vignette />
      {SECTIONS.map((s, k) => (
        <Sequence key={s.id} name={s.id} from={startFrame(s)} durationInFrames={sectionFrames(s)} premountFor={fps}>
          <Body s={s} k={k} />
          <Chips s={s} prev={SECTIONS[k - 1]} next={SECTIONS[k + 1]} />
          {s.kind === "shot" ? <Source s={s} /> : null}
        </Sequence>
      ))}
      <Rail />
      <Subtitles />
      {process.env.REMOTION_MUSIC === "0" ? null : <Audio src={staticFile("audio/pitch/music.wav")} />}
      {SECTIONS.flatMap((s) =>
        s.lines.map((l) => (
          <Sequence key={`${s.id}-${l.clip}`} name={l.clip} from={Math.round((s.start + l.start - l.lead) * fps)} premountFor={fps}>
            <Audio src={staticFile(l.audio)} />
          </Sequence>
        )),
      )}
    </AbsoluteFill>
  );
}
