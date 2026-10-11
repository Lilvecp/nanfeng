"use client";

import { useEffect, useRef, useState } from "react";

// "One agent. The whole treasury desk." — feature cards that expand in place, one at a time.
type Card = { n: string; title: [string, string]; body: string; glyph: React.ReactNode };

const CARDS: Card[] = [
  {
    n: "01 · PREDICT",
    title: ["See the gap", "19 days early"],
    body: "10,000 simulated futures over receivables, FX and harvest prices. You see the probability of a shortfall — not a single guess.",
    glyph: (
      <svg width="120" height="80" viewBox="0 0 120 80"><path d="M4 20 L34 34 L58 62 L84 52 L116 18" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M4 20 L34 26 L58 44 L84 36 L116 8 L116 34 L84 66 L58 76 L34 40 Z" fill="currentColor" opacity=".18" /><circle cx="58" cy="62" r="6" fill="currentColor" /></svg>
    ),
  },
  {
    n: "02 · DECIDE",
    title: ["Cheapest", "money"],
    body: "Pre-export loans, factoring, FOGAPE-backed loans, credit lines and CNY forwards, ranked by real annual cost, speed and how much of the gap they cover. The optimizer picks the mix.",
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M8 44h40M14 44V24M28 44V14M42 44V30" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: "03 · ACT",
    title: ["Acts with", "your code"],
    body: "NanFeng drafts and executes, but anything that moves money waits for you: a six-digit code on WhatsApp or the web. You set every limit.",
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><rect x="10" y="24" width="36" height="24" rx="5" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M18 24v-6a10 10 0 0 1 20 0v6" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: "04 · TALK",
    title: ["Every", "channel"],
    body: "WhatsApp and voice for you in Chile, WeChat/WeCom for your buyer in Shanghai, the web cockpit for the details. In English, Spanish and 中文.",
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M8 12h28v20H20l-8 8v-8H8zM40 22h8v18h-4v6l-6-6H26v-4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" /></svg>,
  },
  {
    n: "05 · PROTECT",
    title: ["Injection-", "proof"],
    body: "Invoices and emails are read as data, never as orders. A changed bank account or a hidden instruction is quarantined and you're told by SMS.",
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M28 6l18 7v13c0 12-8 20-18 24C18 46 10 38 10 26V13z" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M20 28l6 6 11-12" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: "06 · PROVE",
    title: ["On-chain", "audit"],
    body: "Every decision is hash-chained and anchored on FISCO BCOS, so you and your bank can verify what happened, and when.",
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><rect x="6" y="20" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="3" fill="none" /><rect x="36" y="20" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M20 27h16" stroke="currentColor" strokeWidth="3" /></svg>,
  },
];

export function LandingCards() {
  const [open, setOpen] = useState(0);
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(intent.current), []);
  // Hover intent: a short pause so sweeping the mouse across the row doesn't flicker every card.
  const hover = (i: number) => {
    clearTimeout(intent.current);
    intent.current = setTimeout(() => setOpen(i), 110);
  };

  return (
    <div className="vcards" style={{ width: "100%", marginTop: 36 }} onMouseLeave={() => clearTimeout(intent.current)}>
      {CARDS.map((c, i) => {
        const isOpen = i === open;
        return (
          <button
            key={c.n}
            type="button"
            data-reveal
            className={`vcard${isOpen ? " open" : ""}`}
            aria-expanded={isOpen}
            aria-controls={`vcard-body-${i}`}
            onMouseEnter={() => hover(i)}
            onFocus={() => setOpen(i)}
            onClick={() => setOpen(i)}
          >
            <span className="mono vcard-n">{isOpen ? c.n : c.n.slice(0, 2)}</span>
            <h3>{c.title[0]}<br />{c.title[1]}</h3>
            <div id={`vcard-body-${i}`} className="vcard-body" aria-hidden={!isOpen}>
              <hr />
              <p>{c.body}</p>
            </div>
            <span className="glyph" aria-hidden="true">{c.glyph}</span>
          </button>
        );
      })}
    </div>
  );
}
