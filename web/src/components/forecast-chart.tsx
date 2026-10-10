// 90-day Monte Carlo fan chart (CLP M). Mock paths from the Cherry Crisis scenario;
// `resolved` overlays the forecast after the approved plan.

const P50 = "M50,38 L140,92 L221,180 L320,212 L455,218 L590,188 L725,138 L860,102";
const AFTER = "M50,38 L140,92 L221,96 L320,112 L455,108 L590,96 L725,70 L860,52";

export function ForecastChart({ resolved = false, labels = true }: { resolved?: boolean; labels?: boolean }) {
  const yTicks = [150, 100, 50, 0, -50, -100];
  const xTicks = ["D0", "D15", "D30", "D45", "D60", "D75", "D90"];
  return (
    <svg viewBox="0 0 900 310" width="100%" role="img" aria-label={resolved ? "90-day forecast after the plan: cash stays above the buffer." : "90-day forecast. Median crosses zero on day 19."}>
      <rect className="ch-neg" x="50" y="180" width="810" height="100" />
      {[30, 80, 130, 230, 280].map((y) => <line key={y} className="ch-grid" x1="50" x2="860" y1={y} y2={y} />)}
      {[185, 320, 455, 590, 725].map((x) => <line key={x} className="ch-grid" x1={x} x2={x} y1="20" y2="280" />)}
      <line className="ch-zero" x1="50" x2="860" y1="180" y2="180" />
      <path className="ch-band" d="M50,38 L140,76 L221,150 L320,172 L455,174 L590,140 L725,88 L860,44 L860,160 L725,190 L590,240 L455,264 L320,250 L221,202 L140,110 Z" />
      {!resolved && <path className="ch-band2" d="M50,38 L140,84 L221,165 L320,192 L455,196 L590,164 L725,113 L860,73 L860,131 L725,164 L590,214 L455,241 L320,231 L221,191 L140,101 Z" />}
      <path className={resolved ? "ch-before" : "ch-p50"} d={P50} />
      {resolved && <path className="ch-after" d={AFTER} style={{ strokeWidth: 3 }} />}
      <line className="ch-buffer" x1="50" x2="860" y1="140" y2="140" />
      <line className="ch-mark" x1="221" x2="221" y1="20" y2="280" />
      {!resolved && <rect className="ch-dot" x="216" y="175" width="10" height="10" />}
      {labels && (
        <>
          {resolved ? (
            <>
              <rect x="226" y="22" width="196" height="20" fill="var(--ok)" />
              <text x="232" y="36" style={{ fill: "#FFFFFF", fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 700 }}>D19 · 2026-10-28 · GAP CLOSED</text>
            </>
          ) : (
            <>
              <rect x="226" y="22" width="178" height="20" fill="var(--crit)" />
              <text x="232" y="36" style={{ fill: "#FFFFFF", fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 700 }}>D19 · 2026-10-28 · CASH &lt; 0</text>
            </>
          )}
          <rect x="800" y="132" width="60" height="16" fill="var(--surface)" />
          <text className="ch-lbl2" x="856" y="144" textAnchor="end">BUFFER</text>
          {yTicks.map((v, i) => <text key={v} className="ch-axis" x="42" y={34 + i * 50} textAnchor="end">{v}</text>)}
          {xTicks.map((d, i) => <text key={d} className="ch-axis" x={50 + i * 135} y="302" textAnchor={i === 0 ? "start" : i === 6 ? "end" : "middle"}>{d}</text>)}
        </>
      )}
    </svg>
  );
}

export function ForecastLegend({ resolved = false }: { resolved?: boolean }) {
  return (
    <div className="legend">
      {!resolved && <span><i className="sw" style={{ background: "var(--chart-band-2)" }} />P25–75</span>}
      <span><i className="sw" style={{ background: "var(--chart-band)" }} />P10–90</span>
      <span><i className="sw" style={{ background: resolved ? "var(--faint)" : "var(--chart-1)", height: 2 }} />{resolved ? "P50 BEFORE" : "P50"}</span>
      {resolved && <span><i className="sw" style={{ background: "var(--ok)", height: 3 }} />P50 AFTER PLAN</span>}
      <span><i className="sw" style={{ borderTop: "1px dashed var(--warn)", height: 0 }} />BUFFER 40M</span>
    </div>
  );
}
