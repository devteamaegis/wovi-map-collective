"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { WelcomeOverlay, WelcomeExit } from "./WelcomeOverlay";
import { SpotlightTour } from "./SpotlightTour";
import { ONBOARDED_KEY } from "./steps";

type Phase = "idle" | "welcome" | "tour";

interface OnboardingCtx {
  startWelcome: () => void;
  startTour: () => void;
}

const Ctx = createContext<OnboardingCtx>({
  startWelcome: () => {},
  startTour: () => {},
});

export function useOnboarding() {
  return useContext(Ctx);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  // First-run gate — client only, so SSR + first client render show nothing.
  useEffect(() => {
    setMounted(true);
    let seen = false;
    try {
      seen = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      const t = setTimeout(() => setPhase("welcome"), 180);
      return () => clearTimeout(t);
    }
  }, []);

  const markOnboarded = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const onWelcomeExit = (action: WelcomeExit) => {
    markOnboarded();
    setPhase(action === "tour" ? "tour" : "idle");
  };

  const onTourExit = () => {
    markOnboarded();
    setPhase("idle");
  };

  // Stable identity so useOnboarding consumers (sidebar + mobile TourButton)
  // don't re-render every time the provider does.
  const startWelcome = useCallback(() => setPhase("welcome"), []);
  const startTour = useCallback(() => setPhase("tour"), []);
  const value = useMemo<OnboardingCtx>(() => ({ startWelcome, startTour }), [startWelcome, startTour]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted && phase === "welcome" ? (
        <WelcomeOverlay onExit={onWelcomeExit} />
      ) : null}
      {mounted && phase === "tour" ? <SpotlightTour onExit={onTourExit} /> : null}
    </Ctx.Provider>
  );
}
