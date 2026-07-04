# Wovi · Reserve

**Live demo → https://wovi-map-collective.vercel.app** · **Source → https://github.com/devteamaegis/wovi-map-collective**

Wovi is a **relationship-intelligence layer for supply-chain sourcing**, and
**Reserve** is a **spot-buy execution engine** built on top of it. Together they
answer two questions a procurement team actually has:

1. *Who can source what, from whom, through which trusted path* — before a
   transaction happens (the **graph**).
2. *When supply breaks, how do we get an urgent direct-material buy from days to
   hours* — without giving up a single financial control (**Reserve**).

The thesis in one line: **automate the manual connective tissue around a purchase
— AI drafts, a human approves — and let every human control stay exactly where it
is.** Wovi's relationship graph *is* the approved supplier base Reserve broadcasts
to.

> **The demo runs with no login and no config.** It self-seeds a realistic
> scenario set (7 spot buys across every stage, 26 orgs, 42 people, a full DOA
> matrix). On the hosted link the data is **ephemeral** (see [Deployment](#deployment)).

---

## Table of contents

- [What you can do](#what-you-can-do)
- [Reserve — the 7-stage pipeline](#reserve--the-7-stage-pipeline)
- [The relationship graph](#the-relationship-graph)
- [Architecture](#architecture)
- [Integrations (all optional, env-gated)](#integrations-all-optional-env-gated)
- [Auth & security model](#auth--security-model)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)

---

## What you can do

| Screen | What it is |
| --- | --- |
| `/reserve` | Urgent spot-buy queue with a live **downtime-exposure clock** ($/hr × elapsed). |
| `/reserve/[id]` | The **7-stage workspace** — drive one buy end to end (see below). |
| `/reserve/approvals` | The DOA approver queue (SOX §404-framed). |
| `/reserve/analytics` | **Cycle-time** per stage vs the APQC 5-hour benchmark, reconstructed from the audit ledger. |
| `/reserve/integrations` | API tokens, webhooks, notification channels, FX rates, the DOA matrix, the scheduler, and the outbox. |
| `/reserve/admin/users` | Users & roles (only when auth is on). |
| `/` `/graph` `/needs` `/consent` `/directory` `/ask` | The relationship-intelligence layer (dashboard, force-directed graph, needs, consent center, directory CRUD, pathfinder). |

---

## Reserve — the 7-stage pipeline

Each stage is **AI-drafted, human-approved**, and every action lands in a
tamper-evident audit trail.

1. **Triage** — a need is aggregated (manually, or ingested from an MRP / quality
   / line-down system via webhook). A human confirms it's genuinely urgent.
   Multi-line buys (several materials on one requisition) are supported here.
2. **Broadcast RFQ** — Reserve drafts a tailored RFQ and pre-selects the *approved
   supplier base* (suppliers with a supply edge to the buyer in the graph). A
   human approves the send; each invite lands in the outbox and schedules an
   automatic follow-up.
3. **Compare quotes** — supplier replies are normalized into one side-by-side
   comparison, ranked by **landed cost with a lead-time penalty**. Quotes arrive
   by webhook, inbound-email parse, or a paste-and-parse box.
4. **Requisition** — pre-filled from the selected quote (plus any additional
   lines), with missing fields flagged before submission. Quotes in any currency
   convert to a **USD base** so approval routing is currency-agnostic.
5. **DOA approval** — the requisition routes to the right approver by **dollar
   band** (Delegation of Authority matrix). Segregation of duties is enforced: the
   submitter cannot approve their own requisition. One-tap mobile **magic-links**
   let an approver sign off from a phone.
6. **PO release** — Reserve drafts the PO in ERP format (multi-line + freight); a
   human releases the binding document. Export as **CSV / JSON / cXML / EDI-850**.
7. **Goods receipt & 3-way match** — record the delivery and supplier invoice;
   Reserve matches **PO ↔ receipt ↔ invoice** (partial shipments stay open) and
   closes the buy on a clean match. Cross-border metal buys assemble a **Section
   232** customs packet (country-of-melt/smelt + mill cert) in parallel.

Money is stored as `REAL`, timestamps as ISO `TEXT`, and every state change bumps
an optimistic-lock `version` so two users can't clobber the same buy.

---

## The relationship graph

Reserve's "approved supplier base" comes from Wovi's core loop:

1. **One need** — a buyer states a requirement plainly (supplier, facility, part,
   material, or lane).
2. **One useful path** — the pathfinder finds the single most promising trusted
   route: you → a connector → a supplier.
3. **Double opt-in** — both sides consent before any introduction.
4. **Outcome compounds** — the result writes back: confidence rises, new edges
   appear, the graph strengthens. **The manual work is the moat.**

**Confidence model** (`lib/confidence.mjs`) — scores are *computed from recorded
signals*, never invented:

```
edgeConfidence = clamp(
    base[kind]        // knows:35 · introduced_by:40 · brokered_intro:55 · sources_from:60 · supplies:65
  + consentBonus      // double_opt_in:+30 · one_sided:+12 · none:0
  + corroboration     // +5 per distinct positive outcome, cap +20
  - refusalPenalty    // -18 per refusal on this edge
  - recencyDecay,     // 0.4 pts/week since last confirmed, cap -25
  0, 100)

pathConfidence = round( ∏ (edgeConfidence/100 over each hop) × 100 )   // weakest-link aware
```

The pathfinder (`lib/pathfinder.ts`) runs Dijkstra with weight `-log(confidence)`,
so the shortest path *is* the highest-confidence (max-product) path.

---

## Architecture

**Stack:** Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS v3 ·
`better-sqlite3` · `react-force-graph-2d`.

**Design principles**

- **One local datastore.** A single SQLite file (`wovi.db`). `lib/db.ts` opens it,
  applies `lib/schema.sql` (`CREATE TABLE IF NOT EXISTS` throughout), runs
  idempotent column migrations, and seeds baseline FX rates. Synchronous
  server-side queries in typed repos under `lib/repos/` — no ORM, hand-written SQL.
- **AI drafts, human approves.** Every "AI" step (RFQ body, requisition pre-fill,
  PO draft, customs inference, quote parsing) is deterministic local generation
  — no keys required. An optional LLM refines quote parsing when a key is set.
- **Everything external is optional and env-gated.** SMTP, LLM parsing,
  Slack/Teams, cron, ERP push — the app runs fully with none of them, and each
  lights up when configured. Unconfigured outbound messages are still recorded in
  the local **outbox** so the audit is always complete.
- **Server-derived identity.** When auth is on, the acting person is resolved from
  the session cookie server-side — never trusted from the client — which is what
  makes attribution and segregation-of-duties real.
- **Tamper-evident audit.** `audit_events` is a hash chain: each row's hash covers
  its fields plus the previous row's hash, so any edit/delete/insert breaks every
  later hash. `GET /api/health` verifies the chain and returns 503 if broken.

**Pure, testable core.** The money math, quote ranking, DOA routing, 3-way match,
audit hashing, quote parsing, and EDI/cXML builders are pure functions
(`lib/reserve/logic.ts`, `parse.ts`, `audit.ts`, `lib/erp/formats.ts`) covered by
a zero-dependency test suite (`npm test`).

---

## Integrations (all optional, env-gated)

Configure these on `/reserve/integrations` — the page has copy-paste `curl`
examples for every endpoint.

- **Inbound webhooks** (Bearer token): `POST /api/integrations/triggers` (MRP /
  quality / line-down → spot buy), `POST /api/integrations/quotes` (parsed supplier
  quote by ref), `POST /api/integrations/inbound-email` (a mail provider posts a
  supplier reply → parsed into a quote). All rate-limited and size-capped.
- **ERP connectors:** `GET/POST /api/erp/vendors` (vendor-master pull / sync),
  `POST /api/erp/ack` (PO acknowledgement), and PO export as **CSV / JSON / cXML /
  EDI-850** (`GET /api/reserve/po/[id]/export?format=…`).
- **Email:** real SMTP delivery when `SMTP_*` is set (`+ npm install nodemailer`),
  otherwise logged to the outbox.
- **Notifications:** Slack, Microsoft Teams, and generic webhooks, scoped per
  event. All outbound webhook hosts are SSRF-guarded (no private/loopback/metadata).
- **Scheduler:** timed RFQ follow-ups + approval auto-escalation. Point a cron at
  `POST /api/cron` (protected by `CRON_SECRET`) or run due jobs from the UI.
- **FX:** editable currency rates; DOA routing uses a USD base.
- **Vendor master import:** paste/upload an ERP CSV to load the approved base.
- **Health:** `GET /api/health` (no auth) reports DB + audit-chain integrity.

---

## Auth & security model

Sign-in is **opt-in**. By default (`WOVI_AUTH` unset) the app is open — ideal for
a demo. Set **`WOVI_AUTH=on`** to require login and unlock:

- **Accounts & roles** — `admin · broker · buyer · approver · viewer`. First run
  routes to `/setup` to create an admin. Passwords are scrypt-hashed; sessions are
  random tokens stored hashed (sha256), 12-hour expiry.
- **Segregation of duties** — the person who submits a requisition cannot approve
  it (enforced on both the in-app button and the magic-link path).
- **Role-gated config** — the DOA matrix, notification channels, FX rates, vendor
  import, and API-token rotation require `admin`.

Always on, regardless of auth: the audit hash-chain, webhook Bearer auth +
rate-limiting + payload caps, SSRF host-blocking, constant-time secret comparison,
attachment path-traversal guards, and security headers on API responses.

Demo logins (with `WOVI_AUTH=on` after `npm run seed:demo`), password `reserve12`:
`admin@wovi.io` · `p.nair@meridian-aero.com` (buyer) · `g.mensah@harvestco.co.uk`
& `m.reed@meridian-aero.com` (approvers).

---

## Local development

```bash
npm install
npm run dev            # http://localhost:3000  (starts EMPTY)

npm run seed:demo      # load the demo dataset (graph + Reserve scenarios + logins)
npm run db:clear       # wipe ALL data
npm run build          # production build
npm run start          # serve the production build
npm test               # pure-logic test suite (25 assertions, no external deps)
npm run backup         # online SQLite backup → ./backups
```

No accounts, keys, or `.env` are required. `.env.example` documents every optional
integration.

---

## Deployment

### Vercel (the hosted demo)

The live link runs on Vercel. **Important architectural note:** Vercel is
serverless with a read-only filesystem except `/tmp`, and `better-sqlite3` writes
to a file. So on Vercel the app runs as an **ephemeral demo** — it detects Vercel
(`process.env.VERCEL`), stores the DB in `/tmp/wovi.db`, and **auto-seeds on cold
start** so the link is always populated and clickable. Writes work within a warm
instance but **do not persist** across cold starts or between instances. No env
vars are needed; it's self-configuring.

```bash
vercel deploy --prod
```

### Persistent hosting (Railway / Fly / Render / any container host)

For real persistence, deploy the included `Dockerfile` (Next.js standalone) and
mount a volume, pointing `WOVI_DB_PATH` at it:

```bash
docker build -t wovi .
docker run -p 3000:3000 -v wovi-data:/data -e WOVI_DB_PATH=/data/wovi.db wovi
```

Set `WOVI_AUTH=on` for multi-user, and back up with `npm run backup` (or a cron).
For a fully-managed serverless DB instead of a volume, the SQLite layer would move
to a hosted libSQL/Turso or Postgres backend (the repos are the seam).

---

## Testing

`npm test` transpiles the pure modules on the fly (via the installed TypeScript
compiler — no extra deps) and asserts against the **real source**:

- 3-way match (clean / qty / price / both variances, tolerance)
- DOA band routing
- quote ranking (best-value, cheapest, fastest flags)
- audit hash-chain (determinism, field sensitivity, chaining)
- quote parser (multi-line, comma-separated, `/kg` prices, bare quantities, EU
  decimals, word-boundary keywords, lead-time vs validity windows)
- EDI-850 / cXML builders (structure + delimiter-injection sanitizing)

---

## Environment variables

All optional — the app runs with none set.

| Variable | Effect |
| --- | --- |
| `WOVI_AUTH=on` | Require login + roles + segregation of duties. |
| `WOVI_DB_PATH` | DB file location (mount a volume for real hosting). |
| `WOVI_UPLOAD_DIR` | Attachment storage directory. |
| `WOVI_AUTOSEED=on` | Seed an empty DB on boot (auto-on when `VERCEL` is set). |
| `WOVI_BASE_URL` | Absolute base for links in emails / magic-links. |
| `WOVI_SECRET` | Signing secret for approval magic-links. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Real email delivery (`+ npm install nodemailer`). |
| `WOVI_AI_KEY` / `WOVI_AI_MODEL` / `WOVI_AI_BASE_URL` | LLM quote parsing (falls back to the heuristic parser). |
| `WOVI_FOLLOWUP_HOURS` / `WOVI_ESCALATION_HOURS` | Scheduler SLA windows. |
| `CRON_SECRET` | Protects `POST /api/cron`. |

---

## Project structure

```
app/
  reserve/            spot-buy queue, [id] workspace, approvals, analytics,
                      integrations, admin/users, new, actions.ts
  api/
    integrations/     triggers · quotes · inbound-email · health   (Bearer-token)
    erp/              vendors · ack                                 (Bearer-token)
    reserve/po/[id]/export/    CSV · JSON · cXML · EDI-850
    cron/  health/  attachments/[id]/  graph/  search/
  approve/            magic-link approval landing + action
  auth/  login/  setup/       sign-in, first-run admin
  (graph) /  /graph  /needs  /consent  /directory  /ask   relationship layer

components/
  reserve/            SpotBuyWorkspace, ReceivingPanel, QuotePaster, LinesEditor,
                      AttachmentsPanel, ApprovalButtons, IntegrationsPanel/Extra, badges
  auth/               AuthCard, UserMenu, UsersPanel
  AppShell, TopBar, NavLinks, GraphView, onboarding/, forms, primitives (Card, Badge, …)

lib/
  db.ts               open + migrate + seed the SQLite database
  schema.sql          the full schema (Wovi graph + Reserve + integrations)
  auth.ts             scrypt passwords, sessions, roles, requireUser
  security.ts         rate limiting, payload caps, security headers
  seed.mjs / recompute.mjs / confidence.mjs / pathfinder.ts   graph engine
  reserve/            types · logic (pure math) · audit (hash-chain) · token
                      (magic-links) · parse (quote parser) · seed
  erp/formats.ts      cXML + EDI-850 builders
  repos/              reserve · settings · fx · attachments · analytics · quote-ai
                      · orgs · people · needs · edges · …

scripts/              seed-reset.mjs · db-clear.mjs · backup.mjs · test.mjs
middleware.ts         edge-safe auth gate (only active when WOVI_AUTH=on)
Dockerfile            Next.js standalone image for persistent hosting
```
