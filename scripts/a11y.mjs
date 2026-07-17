// Accessibility gate: run axe-core (WCAG 2.0/2.1/2.2 A+AA) against the key pages
// of a running Wovi server and fail if any violation is found. Used by CI; also
// runnable locally with `npm run a11y` against a `next start` server on :3120.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.A11Y_BASE || "http://localhost:3120";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function firstBuyPath(page) {
  try {
    await page.goto(`${BASE}/reserve`, { waitUntil: "networkidle" });
    const hrefs = await page.$$eval('a[href^="/reserve/"]', (els) =>
      els.map((e) => e.getAttribute("href"))
    );
    return hrefs.find((h) => h && /^\/reserve\/\d+$/.test(h)) || null;
  } catch {
    return null;
  }
}

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const buy = await firstBuyPath(page);
  const routes = [
    "/",
    "/reserve",
    "/reserve/new",
    "/reserve/integrations",
    "/needs/new",
    "/graph",
    "/unlock",
    buy, // a live spot-buy workspace (dynamic id)
  ].filter(Boolean);

  let total = 0;
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    if (violations.length) {
      total += violations.length;
      console.error(`\n✗ ${route} — ${violations.length} violation(s)`);
      for (const v of violations) {
        console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
      }
    } else {
      console.log(`✓ ${route}`);
    }
  }

  await browser.close();
  if (total > 0) {
    console.error(`\naxe: ${total} violation(s) — failing.`);
    process.exit(1);
  }
  console.log("\naxe: 0 violations across " + routes.length + " pages.");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
