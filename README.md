# Wovi · Broker Console

Wovi is a relationship-intelligence layer for supply-chain sourcing. Instead of
recording only what already shipped (customs, AIS, shipment records), it captures
the informal relationships sourcing actually runs on — "I know a person who can
get that" — as consented, confidence-scored data, and builds the first map of who
can source what, from whom, and through which trusted path, before a transaction
happens. It starts human-brokered: the broker does the work, the software captures
it and compounds it into a graph. **The manual work is the moat.**

On top of that relationship layer sits **Reserve — a spot-buy execution engine**
(`/reserve`): when supply breaks, it compresses the urgent direct-material buy from
days to hours by running the manual connective work around the purchase — aggregate
the trigger, draft & broadcast the RFQ to the approved supplier base, normalize the
quotes, pre-fill the requisition, route the DOA approval by dollar threshold, draft
the PO for release, and assemble the Section-232 customs packet. **AI drafts; the
human keeps every control** (SOX §404 sign-off, segregation of duties), and every
action lands in an audit trail. Wovi's graph *is* the approved supplier base Reserve
broadcasts to. See the 7-stage workspace at `/reserve/[id]`, the DOA queue at
`/reserve/approvals`, and a live downtime-exposure clock throughout.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Everything runs **100% locally** with no required config. On first launch the app
creates a local SQLite file (`wovi.db`) and applies the schema. **The app starts
empty and open** — no login by default. Turn on multi-user sign-in (accounts,
roles, segregation of duties) with `WOVI_AUTH=on`, which routes first-run to
`/setup` to create an admin. Load the demo set to explore with data:

```bash
npm run seed:demo   # demo dataset (graph + Reserve scenarios + login accounts)
npm run db:clear    # wipe ALL data (returns the app to /setup)
npm run build       # production build (passes clean)
npm run start       # serve the production build
npm test            # run the pure-logic test suite (0 external deps)
npm run backup      # online SQLite backup → ./backups
```

**With `WOVI_AUTH=on`**, demo logins (after `npm run seed:demo`) use password
`reserve12`: `admin@wovi.io` (admin), `p.nair@meridian-aero.com` (buyer),
`g.mensah@harvestco.co.uk` / `m.reed@meridian-aero.com` (approvers).

Reserve is production-shaped: **every external integration is optional and
env-gated** (`.env.example` lists them all) and the app runs fully without any of
them. Auth (SSO seam + password), real SMTP email (`+ npm install nodemailer`),
AI quote parsing, Slack/Teams/webhook notifications, a cron job runner,
multi-currency FX, document storage, ERP push (cXML/EDI-850), backups, and a
`/api/health` readiness probe all light up when configured. Deploy with the
included `Dockerfile` (Next standalone) mounting a volume at `/data`.

## Integrations (`/reserve/integrations`)

Reserve connects to existing systems without deep ERP write-back:

- **Inbound trigger webhook** — `POST /api/integrations/triggers` (Bearer token):
  MRP exceptions, quality rejections, and line-down alerts create spot buys
  directly in the queue. Unknown buyer orgs are created on the fly.
- **Inbound quote webhook** — `POST /api/integrations/quotes`: parsed supplier
  replies land in the comparison view by spot-buy ref.
- **Vendor master import** — paste or upload an ERP vendor-master CSV to load
  the approved supplier base (upserts by name, imports contacts).
- **ERP-ready PO export** — every drafted/released PO downloads as CSV or JSON
  for ERP import.
- **Slack notifications** — set an incoming-webhook URL and approval events post
  live; every outbound message (RFQ broadcasts, follow-ups, approvals, PO
  releases) is also recorded in a local **outbox** for a complete audit.
- **Inbound email → quote** — `POST /api/integrations/inbound-email`: a mail
  provider's inbound-parse posts a supplier reply; it's parsed (AI or heuristic)
  into a structured quote and attached to the referenced spot buy.
- **ERP connectors** — `GET/POST /api/erp/vendors` (vendor-master pull/sync),
  PO push as CSV/JSON/**cXML**/**EDI-850**, and `POST /api/erp/ack` (PO
  acknowledgement callback).
- **Notification channels** — Slack, **Microsoft Teams**, and generic webhooks,
  scoped per event; every message is also recorded in the local **outbox**.
- **Scheduled automation** — timed RFQ follow-ups and approval auto-escalation
  fire on an SLA clock; point a cron at `POST /api/cron` or run due jobs from the UI.
- **Currency (FX)** — quotes in any currency convert to a USD base so DOA bands
  and comparisons are apples-to-apples; rates are editable.
- **DOA matrix editor** — manage the delegation-of-authority bands that route
  approvals, replacing the spreadsheet.
- **Health probe** — `GET /api/health` (no auth) reports DB + audit-chain
  integrity, returning 503 to pull a bad instance out of rotation.

Copy-paste `curl` examples for every endpoint are on the integrations page.

## Reserve, production-shaped

Beyond the 7-stage pipeline, Reserve enforces the controls a real deployment
needs: **role-based access with segregation of duties** (whoever submits a
requisition can't approve it), a **tamper-evident audit hash-chain** (any edit
breaks every later hash — verified by `/api/health`), **optimistic concurrency**
(a PO releases once; two approvers can't both decide a sign-off), a **goods
receipt + 3-way match** stage (PO ↔ receipt ↔ invoice, partial shipments
supported) that closes the buy, **document attachments** (mill certs, invoices,
quote PDFs), **one-tap mobile approval magic-links** (HMAC-signed, expiring), and
a **cycle-time analytics** page (`/reserve/analytics`) measuring each stage
against the APQC 5-hour benchmark from the audit ledger.

## The core loop

1. **One need** — a buyer states a capability or requirement plainly (supplier,
   facility, part, material, or lane).
2. **One useful path** — the pathfinder finds the single most promising trusted
   route: you → a connector → a supplier.
3. **Double opt-in** — both sides consent before any introduction; each side's
   consent is recorded.
4. **Outcome compounds** — the result (consented intro, refusal, correction,
   sourced) writes back: confidence rises, new edges appear, the graph strengthens.

Drive the whole loop from a need's brokering workspace
(`/needs/[id]`): create a need → promote a suggested path → log outreach →
record both consents → watch the path turn `consented`, a `double_opt_in` edge
form, confidences recompute, and the dashboard + graph update.

## Screens

- `/` **Dashboard** — stats, "needs that need you", pending double opt-ins,
  recently strengthened, and an embedded graph snapshot.
- `/graph` **Relationship Graph** (centerpiece) — full-screen force-directed graph;
  filter by node kind, tag, region, consent, and min-confidence; click any node or
  edge for a detail panel (including the "why this score" confidence breakdown).
- `/needs`, `/needs/new`, `/needs/[id]` — list, create, and the brokering workspace.
- `/consent` **Consent Center** — all consent records grouped by status, with the
  awaiting-double-opt-in queue and one-click resolve.
- `/directory`, `/directory/org/[id]`, `/directory/person/[id]` — searchable,
  fully editable orgs & people (full CRUD), each with a neighborhood mini-graph.
- `/ask` **Ask the Map** — pathfinder: from any org/person, find the top trusted
  routes to a supplier/facility, then "broker this" to pre-fill a need + path.

## Onboarding & mobile

- **First-run onboarding** (`components/onboarding/`) — a full-screen welcome
  sequence explains, in plain language, what Wovi is and the four-step loop, then
  offers a guided spotlight tour that walks the real console across every screen.
  It shows once (gated on `localStorage["wovi.onboarded"]`), is skippable and
  keyboard-driven, respects `prefers-reduced-motion`, and is replayable any time
  from the **"Take the tour"** control in the sidebar (or the mobile menu).
- **Responsive down to ~360px** — a hamburger opens a slide-in nav drawer below
  1024px, the graph's filter panel becomes a bottom sheet with a full-width
  touch-enabled canvas, and every page stacks cleanly. The desktop layout is
  unchanged.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS** with the Wovi design tokens wired into CSS variables
- **better-sqlite3** — the only datastore: a single local `wovi.db`, synchronous
  server-side queries. `lib/db.ts` opens the DB, runs `lib/schema.sql` if tables
  don't exist, and seeds if empty.
- Server logic via **Server Actions** + Route Handlers; all DB access server-side
- **react-force-graph-2d** for the canvas graph (client-only, no external services)
- Fonts via `next/font/google` (Newsreader, Inter, IBM Plex Mono)
- Hand-written SQL in typed repos under `lib/repos/`

## Confidence model (`lib/confidence.ts`)

Scores are computed from seeded/recorded signals, not invented. Every edge:

```
edgeConfidence = clamp(
    base[kind]          // knows:35, introduced_by:40, brokered_intro:55, sources_from:60, supplies:65
  + consentBonus        // double_opt_in:+30, one_sided:+12, none:0
  + corroboration       // +5 per distinct positive outcome (interested/consented/sourced), cap +20
  - refusalPenalty      // -18 per refusal outcome on this edge
  - recencyDecay,       // 0.4 pts/week since last_confirmed_at (or first_seen_at), cap -25
  0, 100)

pathConfidence = round( product(edgeConfidence/100 for each hop edge) * 100 )   // weakest-link aware
```

An edge is recomputed whenever an outreach outcome, consent change, or outcome
event touches it; a path is recomputed from its hop edges. The graph page and
edge/path detail views show the full "why this score" breakdown — each term's
contribution. The pathfinder (`lib/pathfinder.ts`) runs Dijkstra over the edge
graph with weight `-log(confidence)`, so the shortest path is exactly the
highest-confidence (max-product) path; results are ranked by path confidence then
fewest hops.

## Project structure

```
app/            layout, dashboard, graph, needs, consent, directory, ask, api, actions
components/     AppShell, Eyebrow, StatCard, Card, Badge, ConfidenceBar, DataTable,
               Drawer, EmptyState, GraphView, GraphSnapshot, forms, …
lib/            db.ts, schema.sql, seed (mjs+ts), confidence, recompute, pathfinder,
               types.ts, repos/
scripts/        seed-reset.mjs
```
