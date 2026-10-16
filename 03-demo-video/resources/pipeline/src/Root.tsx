import { Composition } from "remotion";
import "./brand";
import { ALL, cutFrames, DemoVideo, FPS, SHORT } from "./Video";

export function Root() {
  return (
    <>
      {/* Deliverable 03: the full demo, ≤ 5:00, narration EN, subtitles EN + 中文. */}
      <Composition id="NanFengDemo" component={DemoVideo} defaultProps={{ ids: ALL, opening: true, endCard: true }}
        durationInFrames={cutFrames(ALL)} fps={FPS} width={1920} height={1080} />
      {/* Deck slide 4 (≤ 2:30): the live run, the plan, the approval and its on-chain proof. */}
      <Composition id="NanFengDemoShort" component={DemoVideo} defaultProps={{ ids: SHORT, opening: false, endCard: false }}
        durationInFrames={cutFrames(SHORT, false, false)} fps={FPS} width={1920} height={1080} />
    </>
  );
}
