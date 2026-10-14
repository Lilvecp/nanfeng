import type { Metadata } from "next";

export const metadata: Metadata = { title: "Private desk · Design system · NanFeng" };

// Reference page for the team: tokens and components of the Private desk direction (fe-01).
export default function DesignSystemPage() {
  return (
    <div>
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1440px" }}>

    <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", border: "1px solid var(--line)", background: "var(--surface)", borderTop: "3px solid var(--accent)" }}>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="brand" style={{ padding: "0" }}><span className="brand-mark">南</span>NANFENG<span className="muted" style={{ fontWeight: "400" }}>/CFO</span></div>
        <span className="eyebrow">Direction 4 · Design system · v2 · Direction 1 palette · Direction 2 layout &amp; type · Ant Group / Miaoxiang cues</span>
        <h1 className="h1" style={{ fontSize: "56px" }}>Private desk</h1>
        <p style={{ margin: "0", color: "var(--muted)", fontSize: "16px", maxWidth: "660px" }}>A private bank&apos;s treasury desk: porcelain and ink navy for calm, terminal density and monospaced figures for precision, and nothing louder than ink navy, with brass for the fine lines. Layout cues from Ant Group and Miaoxiang — centered bold headlines, pill controls, softer cards, an Ask-NanFeng prompt bar and the 南风 dot globe — all on the Private bank palette.</p>
      </div>
      <div style={{ padding: "24px", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "8px" }} className="mono small">
        <span className="eyebrow">Color roles</span>
        <span><b style={{ color: "var(--accent)" }}>Navy</b> · interaction, data, links</span>
        <span><b style={{ color: "var(--brass)" }}>Brass</b> · detail only, never text on surfaces</span>

        <span><b style={{ color: "var(--crit)" }}>Critical red</b> · cash at risk, L3, day-19 marker</span>
        <span className="muted">Direction 1 palette, unchanged. Semantic colors stay separate from the navy accent.</span>
      </div>
    </header>

    <section className="card">
      <div className="card-h"><span className="h3">Color tokens</span><span className="hint">All text pairs ≥ 4.5:1 · light is default</span></div>
      <div className="card-b" style={{ gap: "16px" }}>
        <span className="eyebrow">Light (default)</span>
        <div className="sw-row" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}>
          <div><div className="swatch" style={{ background: "#F6F6F3" }}></div><div className="sw-cap"><b>BG</b><span className="muted">#F6F6F3</span></div></div>
          <div><div className="swatch" style={{ background: "#FFFFFF" }}></div><div className="sw-cap"><b>SURFACE</b><span className="muted">#FFFFFF</span></div></div>
          <div><div className="swatch" style={{ background: "#14171C" }}></div><div className="sw-cap"><b>TEXT</b><span className="muted">#14171C</span></div></div>
          <div><div className="swatch" style={{ background: "#5B616B" }}></div><div className="sw-cap"><b>MUTED</b><span className="muted">#5B616B</span></div></div>
          <div><div className="swatch" style={{ background: "#1F3358" }}></div><div className="sw-cap"><b>ACCENT · NAVY</b><span className="muted">#1F3358</span></div></div>
          <div><div className="swatch" style={{ background: "#8C6D2E" }}></div><div className="sw-cap"><b>DETAIL · BRASS</b><span className="muted">#8C6D2E</span></div></div>
          <div><div className="swatch" style={{ background: "#1E6B4A" }}></div><div className="sw-cap"><b>SUCCESS</b><span className="muted">#1E6B4A</span></div></div>
          <div><div className="swatch" style={{ background: "#8A5A00" }}></div><div className="sw-cap"><b>WARNING</b><span className="muted">#8A5A00</span></div></div>
          <div><div className="swatch" style={{ background: "#A3262A" }}></div><div className="sw-cap"><b>CRITICAL</b><span className="muted">#A3262A</span></div></div>
        </div>
        <span className="eyebrow">Dark</span>
        <div className="sw-row" style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}>
          <div><div className="swatch" style={{ background: "#0E1116" }}></div><div className="sw-cap"><b>BG</b><span className="muted">#0E1116</span></div></div>
          <div><div className="swatch" style={{ background: "#151A21" }}></div><div className="sw-cap"><b>SURFACE</b><span className="muted">#151A21</span></div></div>
          <div><div className="swatch" style={{ background: "#ECEDEF" }}></div><div className="sw-cap"><b>TEXT</b><span className="muted">#ECEDEF</span></div></div>
          <div><div className="swatch" style={{ background: "#A3AAB5" }}></div><div className="sw-cap"><b>MUTED</b><span className="muted">#A3AAB5</span></div></div>
          <div><div className="swatch" style={{ background: "#A9BEE6" }}></div><div className="sw-cap"><b>ACCENT</b><span className="muted">#A9BEE6</span></div></div>
          <div><div className="swatch" style={{ background: "#C9A866" }}></div><div className="sw-cap"><b>BRASS</b><span className="muted">#C9A866</span></div></div>
          <div><div className="swatch" style={{ background: "#62C294" }}></div><div className="sw-cap"><b>SUCCESS</b><span className="muted">#62C294</span></div></div>
          <div><div className="swatch" style={{ background: "#E3AE52" }}></div><div className="sw-cap"><b>WARNING</b><span className="muted">#E3AE52</span></div></div>
          <div><div className="swatch" style={{ background: "#F2817C" }}></div><div className="sw-cap"><b>CRITICAL</b><span className="muted">#F2817C</span></div></div>
        </div>
      </div>
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
      <div className="card"><div className="card-h"><span className="h3">Display · IBM Plex Sans Condensed</span></div><div className="card-b"><span className="display" style={{ fontSize: "40px", lineHeight: "1" }}>Crunch D19</span><span className="hint">600 · uppercase · OFL</span></div></div>
      <div className="card"><div className="card-h"><span className="h3">Body · IBM Plex Sans</span></div><div className="card-b"><span style={{ fontSize: "15px" }}>Shanghai Hongxin will pay 45 days late. Plan ready.</span><span className="hint">400/500/600 · 14px base · OFL</span></div></div>
      <div className="card"><div className="card-h"><span className="h3">Numeric · JetBrains Mono</span></div><div className="card-b"><span className="num" style={{ fontSize: "18px", fontWeight: "700" }}>CLP $176.000.000</span><span className="num" style={{ fontSize: "18px", fontWeight: "700" }}>USD 180,000.00 · ¥1,200,000</span><span className="num muted small">2026年10月09日 09:14:06</span></div></div>
    </section>
    <div className="alert" style={{ fontFamily: "var(--f-mono)", fontSize: "12px" }}><span className="ic" style={{ background: "var(--accent)" }}>SELF-HOST</span><span>All fonts OFL, shipped as subset woff2 from our own origin (src/fonts). CJK uses the system font (PingFang SC, Microsoft YaHei, Noto Sans SC). No third-party font CDN, at build time or in production.</span></div>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
      <div className="card"><div className="card-h"><span className="h3">Buttons</span></div><div className="card-b" style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button">Review plan</button><button className="btn btn-primary" type="button">Approve</button><button className="btn btn-secondary" type="button">Ask why</button><button className="btn btn-ghost" type="button">History</button><button className="btn btn-danger" type="button">Kill switch</button><button className="btn btn-primary" type="button" disabled>Disabled</button>
      </div></div>
      <div className="card"><div className="card-h"><span className="h3">Inputs</span></div><div className="card-b">
        <div className="field"><label htmlFor="nv-ds-1">L2 limit / action</label><input id="nv-ds-1" className="input" defaultValue="CLP 25.000.000" /></div>
        <div className="field"><label htmlFor="nv-ds-2">Beneficiary</label><input id="nv-ds-2" className="input err" defaultValue="CL 00-991-55301" /><span className="hint err">ERR · NOT ON ALLOWLIST → L3</span></div>
      </div></div>
      <div className="card"><div className="card-h"><span className="h3">Permission tiers</span></div><div className="card-b">
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><span className="tier t0"><b>L0</b><span>READ</span></span><span className="small muted">Read &amp; analyse</span></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><span className="tier t1"><b>L1</b><span>DRAFT</span></span><span className="small muted">Reminders, quotes</span></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><span className="tier t2"><b>L2</b><span>ACT</span></span><span className="small muted">Within limits, allowlist</span></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}><span className="tier t3"><b>L3</b><span>OTP</span></span><span className="small muted">Owner + one-time code</span></div>
      </div></div>
      <div className="card"><div className="card-h"><span className="h3">KPI cell · badges</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}><div className="kpi"><span className="kpi-l">P(cash&lt;0) 19D</span><span className="kpi-v" style={{ color: "var(--crit)" }}>81.3%</span></div><div className="kpi"><span className="kpi-l">Crunch day</span><span className="kpi-v">D19</span></div></div>
        <div className="card-b" style={{ flexDirection: "row", flexWrap: "wrap", borderTop: "1px solid var(--line)" }}><span className="badge ok">Verified</span><span className="badge warn">Pending</span><span className="badge crit">Blocked</span><span className="badge acc">Best</span><span className="badge solid crit">Live threat</span></div>
      </div>
      <div className="card" style={{ gridColumn: "span 2" }}><div className="card-h"><span className="h3">Table · blotter</span></div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Time</th><th>Counterparty</th><th className="r">Amount</th><th className="r">Days late</th><th>State</th></tr></thead><tbody>
          <tr className="pick"><td className="num">09:08:41</td><td>SHANGHAI FRESH IMPORTS</td><td className="r num">USD 180,000.00</td><td className="r num down">+45</td><td><span className="badge crit">Overdue</span></td></tr>
          <tr><td className="num">08:12:03</td><td>GUANGZHOU ORCHARD TRADING</td><td className="r num">USD 96,400.00</td><td className="r num">0</td><td><span className="badge ok">On time</span></td></tr>
        </tbody></table></div>
      </div>
      <div className="card" style={{ gridColumn: "1 / -1" }}><div className="card-h"><span className="h3">Alerts</span></div><div className="card-b">
        <div className="alert crit"><span className="ic">CRIT</span><span><b>CASH &lt; 0 IN 19D</b> · P=0.81 · 10,000 paths</span></div>
        <div className="alert warn"><span className="ic">WARN</span><span><b>CNY EXPOSURE</b> · ¥1,200,000 unhedged 60D</span></div>
        <div className="alert ok"><span className="ic">OK</span><span><b>CHAIN VERIFIED</b> · sample alert, not a real anchor</span></div>
      </div></div>
      <div className="card" style={{ gridColumn: "span 2" }}><div className="card-h"><span className="h3">Chart · fan</span><div className="legend"><span><i className="sw" style={{ background: "var(--chart-band-2)" }}></i>P25–75</span><span><i className="sw" style={{ background: "var(--chart-band)" }}></i>P10–90</span><span><i className="sw" style={{ background: "var(--chart-1)", height: "2px" }}></i>P50</span><span><i className="sw" style={{ borderTop: "1px dashed var(--brass)", height: "0" }}></i>BUFFER</span><span><i className="sw" style={{ background: "var(--crit)" }}></i>DAY 19</span></div></div>
        <div className="card-b"><svg viewBox="0 0 900 310" width="100%" role="img" aria-label="Fan chart style sample">
          <rect className="ch-neg" x="50" y="180" width="810" height="100"></rect>
          <line className="ch-grid" x1="50" x2="860" y1="30" y2="30"></line><line className="ch-grid" x1="50" x2="860" y1="80" y2="80"></line><line className="ch-grid" x1="50" x2="860" y1="130" y2="130"></line><line className="ch-grid" x1="50" x2="860" y1="230" y2="230"></line><line className="ch-grid" x1="50" x2="860" y1="280" y2="280"></line>
          <line className="ch-zero" x1="50" x2="860" y1="180" y2="180"></line>
          <path className="ch-band" d="M50,38 L140,76 L221,150 L320,172 L455,174 L590,140 L725,88 L860,44 L860,160 L725,190 L590,240 L455,264 L320,250 L221,202 L140,110 Z"></path>
          <path className="ch-band2" d="M50,38 L140,84 L221,165 L320,192 L455,196 L590,164 L725,113 L860,73 L860,131 L725,164 L590,214 L455,241 L320,231 L221,191 L140,101 Z"></path>
          <path className="ch-p50" d="M50,38 L140,92 L221,180 L320,212 L455,218 L590,188 L725,138 L860,102"></path>
          <line className="ch-buffer" x1="50" x2="860" y1="140" y2="140"></line>
          <line className="ch-mark" x1="221" x2="221" y1="20" y2="280"></line><rect className="ch-dot" x="216" y="175" width="10" height="10"></rect>
          <rect x="226" y="22" width="92" height="20" fill="var(--crit)"></rect><text x="232" y="36" style={{ fill: "#FFFFFF", fontFamily: "var(--f-mono)", fontSize: "11px", fontWeight: "700" }}>D19 · &lt;0</text>
          <text className="ch-axis" x="42" y="34" textAnchor="end">150</text><text className="ch-axis" x="42" y="184" textAnchor="end">0</text><text className="ch-axis" x="42" y="284" textAnchor="end">-100</text>
        </svg></div>
      </div>
      <div className="card"><div className="card-h"><span className="h3">Timeline · chat</span></div><div className="card-b">
        <div className="tl">
          <div className="tl-item done"><span className="muted">09:08:49</span><span className="tl-dot"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span><span>montecarlo.run <span className="tier t0"><b>L0</b></span> 4.2s</span></div>
          <div className="tl-item now"><span className="muted">09:09:06</span><span className="tl-dot">!</span><span>loan.request <span className="tier t3"><b>L3</b></span> WAIT</span></div>
        </div>
        <div className="bubble in">Plan ready: PAE loan USD 142,400. Saves CLP 1.7M (45%). APPROVE / WHY<span className="t">09:09</span></div>
        <div className="bubble out">WHY<span className="t">09:12</span></div>
      </div></div>
    </section>

    </div>
    </div>
  );
}
