"use client";

import { useEffect, useRef, useState } from "react";

// "Security Control Center": one integrated panel. The workflow across the top shows a payment
// request moving through NanFeng's checks; the three modules below are the parts of that system.
const FLOW = [
  { n: "01", label: "Request enters", sub: "Payment or instruction" },
  { n: "02", label: "NanFeng evaluates", sub: "Against cash & policy" },
  { n: "03", label: "Tier check", sub: "L0 → L3 limits" },
  { n: "04", label: "Quarantine", sub: "Hidden instructions out" },
  { n: "05", label: "Authorize", sub: "Owner code (OTP)" },
  { n: "06", label: "Logged", sub: "Anchored on-chain" },
];

type ModuleId = "tiers" | "injection" | "audit";
/** Which workflow steps each module is responsible for. */
const COVERS: Record<ModuleId, number[]> = { tiers: [1, 2, 4], injection: [3], audit: [5] };

const TIERS = [
  { t: 0, k: "READ", d: "Read & analyse" },
  { t: 1, k: "DRAFT", d: "Reminders, quotes" },
  { t: 2, k: "ACT", d: "Within your limits" },
  { t: 3, k: "OTP", d: "Owner + one-time code" },
];

export function SecurityControl() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<ModuleId | null>(null);

  // The request walks through the six steps while the panel is on screen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id);
      if (e.isIntersecting) id = setInterval(() => setStep((s) => (s + 1) % (FLOW.length + 2)), 1100);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(id);
    };
  }, []);

  const lit = (i: number) => (focus ? COVERS[focus].includes(i) : i <= step);
  const progress = focus ? null : Math.min(step, FLOW.length - 1) / (FLOW.length - 1);

  return (
    <div ref={root} className={`scc${focus ? " has-focus" : ""}`} data-reveal>
      <div className="scc-flow" role="list" aria-label="How a payment request is checked">
        <div className="scc-rail" aria-hidden="true">
          <span className="scc-rail-fill" style={{ transform: `scaleX(${progress ?? 0})`, opacity: progress === null ? 0 : 1 }} />
        </div>
        {FLOW.map((f, i) => (
          <div key={f.n} role="listitem" className={`scc-step${lit(i) ? " on" : ""}${!focus && i === step ? " now" : ""}${i === FLOW.length - 1 ? " last" : ""}`}>
            <span className="scc-node" aria-hidden="true" />
            <span className="scc-step-n">{f.n}</span>
            <b>{f.label}</b>
            <span className="scc-step-sub">{f.sub}</span>
          </div>
        ))}
      </div>

      <div className="scc-modules" onMouseLeave={() => setFocus(null)}>
        <section className={`scc-mod${focus === "tiers" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("tiers")} onFocus={() => setFocus("tiers")} tabIndex={0} aria-labelledby="scc-tiers">
          <span className="scc-mod-steps">Steps 02 · 03 · 05</span>
          <h3 className="h2" id="scc-tiers">Permission tiers</h3>
          <ol className="scc-tiers">
            {TIERS.map((x) => (
              <li key={x.t}>
                <span className={`tier t${x.t}`}><b>L{x.t}</b><span>{x.k}</span></span>
                <span className="scc-tier-d">{x.d}</span>
              </li>
            ))}
          </ol>
          <p className="muted small">Least privilege by default. You set every limit.</p>
        </section>

        <section className={`scc-mod${focus === "injection" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("injection")} onFocus={() => setFocus("injection")} tabIndex={0} aria-labelledby="scc-inj">
          <span className="scc-mod-steps">Step 04</span>
          <div className="scc-mod-head">
            <h3 className="h2" id="scc-inj">Prompt-injection defense</h3>
            <span className="badge ok"><span className="dot" aria-hidden="true" />Protected</span>
          </div>
          <ul className="scc-rules">
            <li>Instructions hidden in invoices and emails are treated as data, not commands.</li>
            <li>Changed bank details are quarantined; you&apos;re told by SMS.</li>
          </ul>
          <span className="scc-filter mono small"><span className="down">2 blocked today</span> · bank-detail swap · injected email</span>
        </section>

        <section className={`scc-mod final${focus === "audit" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("audit")} onFocus={() => setFocus("audit")} tabIndex={0} aria-labelledby="scc-audit">
          <span className="scc-mod-steps">Step 06 · final record</span>
          <h3 className="h2" id="scc-audit">On-chain audit trail</h3>
          <p className="muted small">Every decision is hash-chained and anchored to FISCO BCOS — verifiable by you and your bank.</p>
          <div className="scc-chain" aria-hidden="true">
            <span /><i /><span /><i /><span className="sealed" />
          </div>
          <span className="mono small muted">Last anchor #8,412,077 · <span className="up">verified</span></span>
        </section>
      </div>
    </div>
  );
}
