"use client";

import { useEffect } from "react";

/**
 * Apple-style scroll reveal: every [data-reveal] element fades and rises into place the first
 * time it enters the viewport. Siblings are staggered. The state lives in a data attribute,
 * not a class, so React re-rendering className (e.g. an expanding card) never hides it again. Content is only hidden once this runs,
 * so without JavaScript (or with reduced motion) everything is simply visible.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    els.forEach((el) => {
      const sibs = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.hasAttribute("data-reveal")) : [el];
      el.style.setProperty("--reveal-delay", `${Math.min(sibs.indexOf(el), 6) * 90}ms`);
      // Anything already on screen at load stays put; only what is below the fold animates.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.setAttribute("data-revealed", "");
    });
    root.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((el) => el.hasAttribute("data-revealed") || io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
