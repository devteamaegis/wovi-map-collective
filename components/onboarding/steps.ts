// Single source of truth for the onboarding copy: the immersive welcome
// sequence and the spotlight tour stops. Copy is in the Wovi voice — calm,
// plain, confident; italics (em) carry the emphasis.

export type TitleSeg = { t: string; em?: boolean };

export type WelcomeVariant =
  | "intro"
  | "gap"
  | "idea"
  | "loop"
  | "consent"
  | "compounds";

export interface WelcomeStep {
  id: string;
  eyebrow: string;
  title: TitleSeg[];
  body: string;
  cta: string;
  variant: WelcomeVariant;
}

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    id: "intro",
    eyebrow: "00 — Wovi",
    title: [
      { t: "The relationships behind every " },
      { t: "sourcing decision.", em: true },
    ],
    body: "Most sourcing runs on who you know — a quiet network of trust that never makes it into a system. Wovi is where that network finally lives.",
    cta: "Show me how",
    variant: "intro",
  },
  {
    id: "gap",
    eyebrow: "01 — The gap",
    title: [{ t: "Records show what " }, { t: "already shipped.", em: true }],
    body: "Customs and shipment data tell you the past. They can't tell you who could source something next, or who would vouch for whom. That knowledge lives in people's heads.",
    cta: "Next",
    variant: "gap",
  },
  {
    id: "idea",
    eyebrow: "02 — The idea",
    title: [{ t: "A broker records what they " }, { t: "actually know.", em: true }],
    body: '"I know someone who can get that." You capture it as a relationship — who knows whom, how strongly, and how you know. Quiet knowledge becomes a graph you can search.',
    cta: "Next",
    variant: "idea",
  },
  {
    id: "loop",
    eyebrow: "03 — The loop",
    title: [{ t: "One need becomes one " }, { t: "trusted path.", em: true }],
    body: "Every match follows the same four steps. Nothing happens without both sides saying yes — and each result makes the graph a little smarter.",
    cta: "Next",
    variant: "loop",
  },
  {
    id: "consent",
    eyebrow: "04 — The rule",
    title: [{ t: "Both sides consent, " }, { t: "every time.", em: true }],
    body: "No introduction is made until the buyer and the supplier each opt in. Consent isn't a checkbox here — it's the thing that makes a relationship worth trusting.",
    cta: "Next",
    variant: "consent",
  },
  {
    id: "compounds",
    eyebrow: "05 — Why it lasts",
    title: [{ t: "Built one real " }, { t: "relationship at a time.", em: true }],
    body: "Every consented intro raises confidence and adds an edge. The map is built from relationships you earned, not data you scraped.",
    cta: "Enter the console",
    variant: "compounds",
  },
];

export interface TourStop {
  id: string;
  route: string;
  target: string; // data-tour value
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

export const TOUR_STOPS: TourStop[] = [
  {
    id: "nav",
    route: "/",
    target: "sidebar-nav",
    title: "Six places, one workflow",
    body: "This is the whole console — graph, needs, consent, directory, and the pathfinder. You'll rarely need to hunt for anything.",
    placement: "right",
  },
  {
    id: "dashboard-loop",
    route: "/",
    target: "dashboard-loop",
    title: "The loop, always in view",
    body: "The dashboard opens on the four-step loop and what's waiting on you — open needs and consents to chase.",
    placement: "bottom",
  },
  {
    id: "graph",
    route: "/graph",
    target: "graph-canvas",
    title: "Your relationships, mapped",
    body: "Every org and person, every edge. Thicker, solid lines mean stronger, fully-consented relationships. Tap any node or edge to open it.",
    placement: "center",
  },
  {
    id: "graph-filters",
    route: "/graph",
    target: "graph-filters",
    title: "Narrow it to what matters",
    body: "Filter by kind, region, material, or consent — or set a confidence floor to see only relationships you'd stake a name on.",
    placement: "right",
  },
  {
    id: "needs",
    route: "/needs",
    target: "needs-new",
    title: "Start with one need",
    body: "A buyer wants a supplier, part, or lane. State it plainly here, and Wovi looks for one trusted route to fill it.",
    placement: "bottom",
  },
  {
    id: "ask",
    route: "/ask",
    target: "ask-form",
    title: "Ask the map",
    body: "Pick where you're starting and what you're after. The pathfinder walks the graph and returns the most promising trusted paths — you, to a connector, to a supplier.",
    placement: "bottom",
  },
  {
    id: "consent",
    route: "/consent",
    target: "consent-header",
    title: "Where every yes is recorded",
    body: "Both sides opt in before any introduction. This is your queue of who's said yes and who you're still waiting on.",
    placement: "bottom",
  },
  {
    id: "finish",
    route: "/",
    target: "sidebar-tour",
    title: "That's the loop",
    body: "One need, one trusted path, two yeses, an outcome that compounds. Replay this walk any time from here.",
    placement: "right",
  },
];

export const ONBOARDED_KEY = "wovi.onboarded";
