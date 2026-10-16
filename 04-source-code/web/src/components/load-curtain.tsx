/** Entrance curtain of the landing: a dark panel with 南风 that lifts away on load. Pure CSS, so it is gone once the animation ends. */
export function LoadCurtain() {
  return (
    <div className="load-curtain" aria-hidden="true">
      <span>南风</span>
    </div>
  );
}
