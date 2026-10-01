import { useEffect, useState } from "react";

/** True when the visitor has asked macOS (or their OS) to reduce motion. */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Fades elements marked `data-reveal` up into place as they scroll into view. */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("revealed");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** The three ways the note window looks, matching the real app. */
export type FadePhase = "away" | "hover" | "focus";

const STEPS: { phase: FadePhase; ms: number }[] = [
  { phase: "away", ms: 2600 },
  { phase: "hover", ms: 1500 },
  { phase: "focus", ms: 2600 },
];

/** Loops away → hover → focus, like someone using the app during a call. */
export function useFadeDemo(): FadePhase {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step].ms);
    return () => window.clearTimeout(t);
  }, [step, reduced]);
  return reduced ? "away" : STEPS[step].phase;
}
