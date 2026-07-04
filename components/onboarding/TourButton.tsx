"use client";

import { Compass } from "lucide-react";
import { useOnboarding } from "./OnboardingProvider";

// Persistent re-entry control. Replays the full walkthrough (welcome → optional
// tour). Used in the desktop sidebar footer and the mobile menu.
export function TourButton({
  className = "",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { startWelcome } = useOnboarding();
  return (
    <button
      data-tour="sidebar-tour"
      onClick={() => {
        onClick?.();
        startWelcome();
      }}
      className={
        className ||
        "flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
      }
      aria-label="Replay the Wovi walkthrough"
    >
      <Compass size={14} className="text-accent-2" />
      Take the tour
    </button>
  );
}
