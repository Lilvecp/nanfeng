"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/topbar";
import { useLang } from "@/lib/i18n";
import { useLiteClass } from "@/lib/perf";
import type { Lang } from "@/lib/prefs";

type L3 = Record<Lang, string>;

const COPY = {
  kicker: { en: "THE TEAM", es: "EL EQUIPO", zh: "团队" },
  title: {
    en: ["Five students.", "One agent", "that acts."],
    es: ["Cinco estudiantes.", "Un agente", "que actúa."],
    zh: ["五位学生。", "一个会行动的", "代理。"],
  },
  sub: {
    en: "Universidad del Desarrollo, Chile · FinTechathon 2026",
    es: "Universidad del Desarrollo, Chile · FinTechathon 2026",
    zh: "智利发展大学 · FinTechathon 2026",
  },
  hint: { en: "Hover or tap a card for the story", es: "Pasa el mouse o toca una tarjeta", zh: "悬停或点击卡片查看详情" },
  again: { en: "Watch the demo again", es: "Ver la demo otra vez", zh: "再看一次演示" },
  home: { en: "Back to the product", es: "Volver al producto", zh: "返回产品" },
  foot: { en: "NANFENG 南风 · SANDBOX DEMO · NO REAL FUNDS MOVE", es: "NANFENG 南风 · DEMO SANDBOX · NO SE MUEVE DINERO REAL", zh: "南风 NANFENG · 沙盒演示 · 不涉及真实资金" },
} satisfies Record<string, L3 | Record<Lang, string[]>>;

// Photos, headlines and wins come from each member's public LinkedIn profile and posts.
const TEAM: { id: string; name: string; role: L3; bio: L3; tags: string[]; email: string; linkedin: string }[] = [
  {
    id: "valentin", name: "Valentín Castro Pizarro",
    role: { en: "Lead & Product Strategist", es: "Líder y estratega de producto", zh: "负责人 · 产品策略" },
    bio: {
      en: "Led the Lumen team that won the HealthTech hackathon at Summit País Digital (110 of 110 test patients right). Sets NanFeng's scope, story and business model.",
      es: "Lideró a Lumen, ganador de la hackatón HealthTech del Summit País Digital (110 de 110 pacientes de prueba bien). Define el alcance, la historia y el modelo de negocio de NanFeng.",
      zh: "带领 Lumen 赢得 Summit País Digital 健康科技黑客松（110 名测试患者全部判断正确）。负责 NanFeng 的范围、叙事与商业模式。",
    },
    tags: ["Hack4Seniors 2026 · 1st", "Summit País Digital · 1st", "Brandstorm · Top 3 Chile"],
    email: "va.castrop@udd.cl", linkedin: "https://www.linkedin.com/in/valentin-castro-pizarro",
  },
  {
    id: "renato", name: "Renato Alonso Lenis Lara",
    role: { en: "AI Agent Engineer", es: "Ingeniero del agente de IA", zh: "AI 代理工程师" },
    bio: {
      en: "Civil Informatics and Industrial Engineering. Voice and conversational AI for health and accessibility. Builds the agent that reads, plans and acts, and tests it on hundreds of synthetic cases.",
      es: "Ingeniería Civil en Informática e Industrial. IA de voz y conversacional para salud y accesibilidad. Construye el agente que lee, planifica y actúa, y lo prueba con cientos de casos sintéticos.",
      zh: "信息工程与工业工程双专业。专注健康与无障碍的语音与对话式 AI。构建能读取、规划并执行的代理，并以数百个合成案例测试。",
    },
    tags: ["3× hackathon 1st place", "Hack4Seniors 2026 · 1st", "Agent Hackathon 2025 · 1st"],
    email: "r.lenisl@udd.cl", linkedin: "https://www.linkedin.com/in/renatolenis",
  },
  {
    id: "camilo", name: "Camilo Bufadel Faúndez",
    role: { en: "Full-Stack & Blockchain", es: "Full-stack y blockchain", zh: "全栈与区块链" },
    bio: {
      en: "Full-stack developer focused on applied AI and conversational agents (Next.js, Python, TypeScript). Co-founder of Compás. Ships the web app, the backend and the on-chain audit anchor.",
      es: "Desarrollador full-stack enfocado en IA aplicada y agentes conversacionales (Next.js, Python, TypeScript). Cofundador de Compás. Entrega la app web, el backend y el anclaje de auditoría on-chain.",
      zh: "专注应用 AI 与对话代理的全栈开发者（Next.js、Python、TypeScript）。Compás 联合创始人。负责网页应用、后端与链上审计锚定。",
    },
    tags: ["Hack4Seniors 2026 · 1st", "Summit País Digital · 1st", "Mistral AI prize"],
    email: "c.bufadelf@udd.cl", linkedin: "https://www.linkedin.com/in/camilobufadel",
  },
  {
    id: "andy", name: "Andy Villarroel González",
    role: { en: "Security & Compliance", es: "Seguridad y cumplimiento", zh: "安全与合规" },
    bio: {
      en: "Builds and breaks software. At Hack@Latam he built the frontend, WhatsApp/SMS alerts and voice agents. Here: the threat model and the 46-attack red team.",
      es: "Construye y rompe software. En Hack@Latam hizo el frontend, las alertas por WhatsApp/SMS y los agentes de voz. Aquí: el modelo de amenazas y el red team de 46 ataques.",
      zh: "构建并攻破软件。在 Hack@Latam 负责前端、WhatsApp/短信预警与语音代理。在此项目中：威胁模型与 46 项攻击的红队测试。",
    },
    tags: ["Hack4Seniors 2026 · 1st", "Mistral · Best use of LLM", "Cisco Ethical Hacker"],
    email: "a.villarroelg@udd.cl", linkedin: "https://www.linkedin.com/in/andyvillarroel",
  },
  {
    id: "vicente", name: "Vicente Rodríguez Rojas",
    role: { en: "Quant & Data Science", es: "Cuantitativo y datos", zh: "量化与数据科学" },
    bio: {
      en: "Civil Informatics student in Technological Innovation. Built the Monte Carlo forecast, the financing optimizer and NanFeng-Bench.",
      es: "Estudiante de Ingeniería Civil Informática en Innovación Tecnológica. Construyó el pronóstico Monte Carlo, el optimizador de financiamiento y NanFeng-Bench.",
      zh: "技术创新方向信息工程专业学生。构建了蒙特卡洛预测、融资优化器与 NanFeng-Bench。",
    },
    tags: ["Monte Carlo forecast", "MILP optimizer", "NanFeng-Bench 50/50"],
    email: "v.rodriguezr@udd.cl", linkedin: "https://www.linkedin.com/in/vicente-rodriguez-rojas",
  },
];

export default function AboutPage() {
  const lang = useLang();
  const stage = useRef<HTMLDivElement>(null);

  useLiteClass();
  // Pointer-follow glow on the stage + a light 3D tilt on the hovered card. Positions are written once per frame;
  // the card rect is cached while the pointer stays on that card.
  const frame = useRef(0);
  const last = useRef<{ x: number; y: number; card: HTMLElement | null } | null>(null);
  const rect = useRef<{ el: HTMLElement; r: DOMRect } | null>(null);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    last.current = { x: e.clientX, y: e.clientY, card: (e.target as HTMLElement).closest<HTMLElement>(".about-card") };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const l = last.current;
      if (!l) return;
      stage.current?.style.setProperty("--gx", `${l.x}px`);
      stage.current?.style.setProperty("--gy", `${l.y}px`);
      const card = l.card;
      if (!card) return;
      if (rect.current?.el !== card) rect.current = { el: card, r: card.getBoundingClientRect() };
      const r = rect.current.r;
      const x = (l.x - r.left) / r.width;
      const y = (l.y - r.top) / r.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
      card.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
    });
  };
  const onLeave = (e: React.PointerEvent<HTMLElement>) => {
    rect.current = null;
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };

  const title = COPY.title[lang];

  return (
    <div className="about" ref={stage} onPointerMove={onMove}>
      <div className="about-orb a" aria-hidden="true" />
      <div className="about-orb b" aria-hidden="true" />
      <div className="about-grid-bg" aria-hidden="true" />
      <div className="about-glow" aria-hidden="true" />

      <header className="about-bar">
        <Link href="/" aria-label="NanFeng home" className="about-logo"><Logo size={24} stacked={false} /></Link>
        <span style={{ flex: 1 }} />
        <LangSwitch />
        <ThemeToggle />
      </header>

      <main className="about-stage">
        <div className="about-head">
          <span className="about-kicker mono">{COPY.kicker[lang]}</span>
          <h1 className="about-title" aria-label={title.join(" ")}>
            {title.map((line, li) => (
              <span key={li} className={`about-line${li === 1 ? " kw" : ""}`}>
                {line.split(" ").map((w, wi) => (
                  <span key={wi} className="about-word" style={{ "--w": li * 3 + wi } as React.CSSProperties}>{w}&nbsp;</span>
                ))}
              </span>
            ))}
          </h1>
          <p className="about-sub">{COPY.sub[lang]}</p>
        </div>

        <div className="about-row" onPointerLeave={(e) => e.currentTarget.querySelectorAll<HTMLElement>(".about-card").forEach((c) => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); })}>
          {TEAM.map((m, i) => (
            <article key={m.id} tabIndex={0} className="about-card" style={{ "--i": i } as React.CSSProperties} onPointerLeave={onLeave}>
              <div className="about-photo-wrap">
                <Image className="about-photo" src={`/team/${m.id}.jpg`} alt={m.name} width={800} height={800} sizes="(min-width: 1100px) 22vw, 50vw" quality={92} priority={i < 3} />
                <div className="about-over">
                  <p>{m.bio[lang]}</p>
                  <div className="about-links">
                    <a href={m.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
                    <a href={`mailto:${m.email}`}>{m.email}</a>
                  </div>
                </div>
              </div>
              <div className="about-body">
                <h2 className="about-name">{m.name}</h2>
                <span className="about-role">{m.role[lang]}</span>
                <div className="about-tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            </article>
          ))}
        </div>
        <span className="about-hint mono">{COPY.hint[lang]}</span>
      </main>

      <footer className="about-foot">
        <div className="about-cta">
          <Link className="about-main" href="/demo?play=1">{COPY.again[lang]}</Link>
          <Link className="about-ghost" href="/">{COPY.home[lang]}</Link>
        </div>
        <span className="mono small about-legal">{COPY.foot[lang]}</span>
      </footer>
    </div>
  );
}
