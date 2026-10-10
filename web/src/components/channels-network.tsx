"use client";

import { useState } from "react";
import { SailMark } from "@/components/logo";

// "Connected Pacific": one agent at the center, every market's channel around it.
// Asia sits to the west and Latin America to the east, like the two shores of the Pacific,
// without drawing a map. Coordinates live in a 1000 × 560 box shared by the SVG and the nodes.
const W = 1000;
const H = 560;
const HUB = { x: 500, y: 280 };

type Node = {
  id: string;
  name: string;
  region: string;
  role: string;
  x: number;
  y: number;
  side: "left" | "right";
  bend: number;
  /** Signals flow out to the channel, or come back in from it (owner approvals). */
  flow: "out" | "in" | "both";
};

const NODES: Node[] = [
  { id: "web", name: "Web cockpit", region: "Everywhere", role: "Full detail · approvals", x: 405, y: 62, side: "left", bend: -70, flow: "both" },
  { id: "wecom", name: "WeChat · WeCom", region: "China", role: "Importer reminders", x: 150, y: 196, side: "left", bend: 60, flow: "out" },
  { id: "line", name: "LINE · KakaoTalk", region: "Asia", role: "Next markets", x: 230, y: 462, side: "left", bend: -60, flow: "out" },
  { id: "whatsapp", name: "WhatsApp", region: "Latin America", role: "Owner approvals", x: 850, y: 190, side: "right", bend: -60, flow: "in" },
  { id: "voice", name: "Voice", region: "ES · EN · 中文", role: "Daily cash briefing", x: 770, y: 470, side: "right", bend: 70, flow: "out" },
];

/** Gentle quadratic curve from the hub to a node, bowed sideways by `bend`. */
function curve(n: Node) {
  const mx = (HUB.x + n.x) / 2;
  const my = (HUB.y + n.y) / 2;
  const dx = n.x - HUB.x;
  const dy = n.y - HUB.y;
  const len = Math.hypot(dx, dy);
  const cx = mx + (-dy / len) * n.bend;
  const cy = my + (dx / len) * n.bend;
  return `M${HUB.x},${HUB.y} Q${cx.toFixed(1)},${cy.toFixed(1)} ${n.x},${n.y}`;
}

export function ChannelsNetwork() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className={`net${active ? " has-active" : ""}`} onMouseLeave={() => setActive(null)}>
      <div className="net-canvas" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg className="net-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-reveal="net">
          {NODES.map((n, i) => {
            const d = curve(n);
            const state = active ? (active === n.id ? " is-active" : " is-dim") : "";
            return (
              <g key={n.id} className={`net-link${state}`}>
                <path className="net-path" d={d} pathLength={1} />
                {(n.flow === "out" || n.flow === "both") && (
                  <circle className="net-signal" r="3.2">
                    <animateMotion dur={`${3.4 + i * 0.35}s`} repeatCount="indefinite" path={d} begin={`${i * 0.6}s`} />
                  </circle>
                )}
                {(n.flow === "in" || n.flow === "both") && (
                  <circle className="net-signal in" r="3.2">
                    <animateMotion dur={`${3.8 + i * 0.3}s`} repeatCount="indefinite" path={d} keyPoints="1;0" keyTimes="0;1" calcMode="linear" begin={`${0.9 + i * 0.5}s`} />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        <div className="net-hub" data-reveal style={{ left: `${(HUB.x / W) * 100}%`, top: `${(HUB.y / H) * 100}%` }}>
          <span className="net-pulse" aria-hidden="true" />
          <span className="net-pulse late" aria-hidden="true" />
          <span className="net-hub-core">
            <SailMark size={44} />
          </span>
          <span className="net-hub-label">
            <b>NanFeng</b>
            <span>One AI CFO agent</span>
          </span>
        </div>

        <ul className="net-nodes">
          {NODES.map((n) => (
            <li
              key={n.id}
              data-reveal
              tabIndex={0}
              className={`net-node ${n.side}${active === n.id ? " is-active" : active ? " is-dim" : ""}`}
              style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%` }}
              onMouseEnter={() => setActive(n.id)}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive(null)}
            >
              <span className="net-dot" aria-hidden="true" />
              <span className="net-text">
                <b>{n.name}</b>
                <span className="net-region">{n.region}</span>
                <span className="net-role">{n.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
