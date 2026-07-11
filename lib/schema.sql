-- Wovi Broker Console — schema
-- Graph nodes = organizations and people; edges connect any two nodes.

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('buyer','supplier','broker','facility')),
  country TEXT,
  region TEXT,
  materials TEXT,        -- JSON array of material/commodity tags
  capabilities TEXT,     -- JSON array of capability tags
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  org_id INTEGER REFERENCES organizations(id),
  title TEXT,
  whatsapp TEXT,
  wechat TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS needs (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('supplier','facility','part','material','lane')),
  description TEXT,
  material_tag TEXT,
  target_region TEXT,
  requester_org_id INTEGER REFERENCES organizations(id),
  requester_person_id INTEGER REFERENCES people(id),
  status TEXT NOT NULL CHECK(status IN ('open','brokering','matched','closed')) DEFAULT 'open',
  priority TEXT NOT NULL CHECK(priority IN ('low','med','high')) DEFAULT 'med',
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS paths (
  id INTEGER PRIMARY KEY,
  need_id INTEGER NOT NULL REFERENCES needs(id),
  target_org_id INTEGER REFERENCES organizations(id),
  connector_person_id INTEGER REFERENCES people(id),
  rationale TEXT,
  status TEXT NOT NULL CHECK(status IN ('proposed','outreach','awaiting_consent','consented','declined','dead')) DEFAULT 'proposed',
  confidence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS path_hops (
  id INTEGER PRIMARY KEY,
  path_id INTEGER NOT NULL REFERENCES paths(id),
  position INTEGER NOT NULL,
  node_type TEXT NOT NULL CHECK(node_type IN ('org','person')),
  node_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('org','person')),
  source_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('org','person')),
  target_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('knows','sources_from','brokered_intro','supplies','introduced_by')),
  confidence INTEGER NOT NULL DEFAULT 0,
  consent_status TEXT NOT NULL CHECK(consent_status IN ('none','one_sided','double_opt_in')) DEFAULT 'none',
  provenance TEXT,
  evidence_note TEXT,
  first_seen_at TEXT NOT NULL,
  last_confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS outreach (
  id INTEGER PRIMARY KEY,
  path_id INTEGER REFERENCES paths(id),
  edge_id INTEGER REFERENCES edges(id),
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp','wechat','phone','email','in_person')),
  direction TEXT NOT NULL CHECK(direction IN ('out','in')),
  person_id INTEGER REFERENCES people(id),
  summary TEXT NOT NULL,
  outcome TEXT CHECK(outcome IN ('no_reply','interested','refused','corrected','consented')),
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY,
  path_id INTEGER REFERENCES paths(id),
  edge_id INTEGER REFERENCES edges(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  side TEXT NOT NULL CHECK(side IN ('requester','supplier')),
  status TEXT NOT NULL CHECK(status IN ('pending','granted','refused','revoked')) DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS outcomes (
  id INTEGER PRIMARY KEY,
  path_id INTEGER REFERENCES paths(id),
  edge_id INTEGER REFERENCES edges(id),
  result TEXT NOT NULL CHECK(result IN ('consented_intro','declined','dead_end','sourced','corrected')),
  confidence_delta INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_people_org ON people(org_id);
CREATE INDEX IF NOT EXISTS idx_needs_status ON needs(status);
CREATE INDEX IF NOT EXISTS idx_needs_requester_org ON needs(requester_org_id);
CREATE INDEX IF NOT EXISTS idx_paths_need ON paths(need_id);
CREATE INDEX IF NOT EXISTS idx_path_hops_path ON path_hops(path_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);
CREATE INDEX IF NOT EXISTS idx_outreach_edge ON outreach(edge_id);
CREATE INDEX IF NOT EXISTS idx_outreach_path ON outreach(path_id);
CREATE INDEX IF NOT EXISTS idx_consents_path ON consents(path_id);
CREATE INDEX IF NOT EXISTS idx_consents_edge ON consents(edge_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_edge ON outcomes(edge_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_path ON outcomes(path_id);

-- ============ RESERVE — Spot-Buy Execution Engine =============================
-- Reuses organizations (buyer/supplier) + people (buyers, approvers, supplier
-- contacts, brokers). "AI drafts, human approves": drafts are generated locally
-- and released by a human; every action is logged in audit_events.

CREATE TABLE IF NOT EXISTS spot_buys (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  material_number TEXT,
  material_desc TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  uom TEXT,
  required_by TEXT,
  cost_center TEXT,
  plant TEXT,
  trigger TEXT NOT NULL CHECK(trigger IN ('mrp_exception','quality_rejection','line_down','shortage','volume_change','force_majeure')),
  urgency TEXT NOT NULL CHECK(urgency IN ('low','med','high','critical')) DEFAULT 'high',
  downtime_cost_per_hour REAL NOT NULL DEFAULT 0,
  buyer_org_id INTEGER REFERENCES organizations(id),
  buyer_person_id INTEGER REFERENCES people(id),
  cross_border INTEGER NOT NULL DEFAULT 0,
  metal TEXT NOT NULL CHECK(metal IN ('none','steel','aluminum')) DEFAULT 'none',
  ship_from_country TEXT,
  ship_to_country TEXT,
  incoterm TEXT,
  status TEXT NOT NULL CHECK(status IN ('triage','sourcing','quoting','requisition','approval','po','receiving','closed','cancelled')) DEFAULT 'triage',
  urgency_confirmed INTEGER NOT NULL DEFAULT 0,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

-- Multiple materials on a single spot buy (#11). A buy with no lines is treated
-- as single-line using the header material_* fields.
CREATE TABLE IF NOT EXISTS spot_buy_lines (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  line_no INTEGER NOT NULL,
  material_number TEXT,
  material_desc TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  uom TEXT,
  unit_price REAL NOT NULL DEFAULT 0   -- agreed price per unit for this line
);

CREATE TABLE IF NOT EXISTS rfqs (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  draft_body TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','sent','closed')) DEFAULT 'draft',
  approved_by_person_id INTEGER REFERENCES people(id),
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rfq_invites (
  id INTEGER PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES rfqs(id),
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  supplier_org_id INTEGER NOT NULL REFERENCES organizations(id),
  supplier_person_id INTEGER REFERENCES people(id),
  channel TEXT NOT NULL CHECK(channel IN ('email','phone','portal','edi')) DEFAULT 'email',
  status TEXT NOT NULL CHECK(status IN ('invited','followed_up','quoted','declined','no_reply')) DEFAULT 'invited',
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  invited_at TEXT NOT NULL,
  last_followed_up_at TEXT
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  rfq_invite_id INTEGER REFERENCES rfq_invites(id),
  supplier_org_id INTEGER NOT NULL REFERENCES organizations(id),
  supplier_person_id INTEGER REFERENCES people(id),
  unit_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity REAL NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  moq REAL,
  freight_cost REAL NOT NULL DEFAULT 0,
  freight_mode TEXT CHECK(freight_mode IN ('air','expedited_ground','sea','courier','standard')),
  incoterm TEXT,
  valid_until TEXT,
  source_format TEXT CHECK(source_format IN ('pdf','excel','email','phone')),
  notes TEXT,
  selected INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requisitions (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  quote_id INTEGER REFERENCES quotes(id),
  material_number TEXT,
  material_desc TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  uom TEXT,
  cost_center TEXT,
  need_by TEXT,
  supplier_org_id INTEGER REFERENCES organizations(id),
  unit_price REAL NOT NULL DEFAULT 0,
  freight_cost REAL NOT NULL DEFAULT 0,
  total_value REAL NOT NULL DEFAULT 0,
  total_value_base REAL NOT NULL DEFAULT 0,   -- total_value converted to base currency for DOA
  currency TEXT NOT NULL DEFAULT 'USD',
  missing_fields TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','submitted')) DEFAULT 'draft',
  submitted_by_person_id INTEGER REFERENCES people(id),  -- for segregation-of-duties
  created_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS doa_rules (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL,
  min_amount REAL NOT NULL DEFAULT 0,
  max_amount REAL,
  approver_person_id INTEGER REFERENCES people(id),
  org_id INTEGER REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  requisition_id INTEGER REFERENCES requisitions(id),
  level INTEGER NOT NULL DEFAULT 1,
  approver_person_id INTEGER REFERENCES people(id),
  role TEXT,
  threshold_min REAL,
  threshold_max REAL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','escalated')) DEFAULT 'pending',
  escalated_to_person_id INTEGER REFERENCES people(id),
  note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  requisition_id INTEGER REFERENCES requisitions(id),
  po_number TEXT NOT NULL,
  supplier_org_id INTEGER REFERENCES organizations(id),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_value REAL NOT NULL DEFAULT 0,
  incoterm TEXT,
  status TEXT NOT NULL CHECK(status IN ('drafted','released','acknowledged','closed')) DEFAULT 'drafted',
  drafted_at TEXT NOT NULL,
  released_at TEXT,
  released_by_person_id INTEGER REFERENCES people(id),
  acknowledged_at TEXT
);

CREATE TABLE IF NOT EXISTS po_lines (
  id INTEGER PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  line_no INTEGER NOT NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  uom TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customs_packets (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  po_id INTEGER REFERENCES purchase_orders(id),
  required INTEGER NOT NULL DEFAULT 0,
  metal TEXT NOT NULL CHECK(metal IN ('none','steel','aluminum')) DEFAULT 'none',
  hs_code TEXT,
  country_of_melt_pour TEXT,
  country_of_smelt_cast TEXT,
  commercial_invoice_status TEXT NOT NULL CHECK(commercial_invoice_status IN ('missing','drafted','attached')) DEFAULT 'missing',
  mill_cert_status TEXT NOT NULL CHECK(mill_cert_status IN ('missing','requested','received','verified')) DEFAULT 'missing',
  broker_person_id INTEGER REFERENCES people(id),
  status TEXT NOT NULL CHECK(status IN ('not_required','assembling','ready','verified','hold')) DEFAULT 'assembling',
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  actor TEXT NOT NULL CHECK(actor IN ('ai','human','system')),
  actor_person_id INTEGER REFERENCES people(id),
  stage TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  prev_hash TEXT,           -- tamper-evident hash chain (#5)
  hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_buys_status ON spot_buys(status);
CREATE INDEX IF NOT EXISTS idx_spot_buys_buyer ON spot_buys(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_spot_buy ON rfqs(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_rfq_invites_rfq ON rfq_invites(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_invites_spot_buy ON rfq_invites(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_quotes_spot_buy ON quotes(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_spot_buy ON requisitions(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_approvals_spot_buy ON approvals(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver_person_id);
CREATE INDEX IF NOT EXISTS idx_pos_spot_buy ON purchase_orders(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON po_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_customs_spot_buy ON customs_packets(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_audit_spot_buy ON audit_events(spot_buy_id);

-- ============ INTEGRATIONS ====================================================
-- Key-value settings: api_token (inbound webhook auth), slack_webhook_url, etc.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Local outbox: every outbound message Reserve generates (RFQ broadcasts,
-- follow-ups, approval notifications, PO releases). With no mail server
-- configured these are recorded as 'logged'; Slack rows are delivered live
-- when a webhook URL is configured.
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('email','slack','teams','webhook')),
  recipient TEXT,
  subject TEXT,
  body TEXT,
  spot_buy_id INTEGER REFERENCES spot_buys(id),
  status TEXT NOT NULL CHECK(status IN ('logged','sent','failed')) DEFAULT 'logged',
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_spot_buy ON outbox(spot_buy_id);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);

-- ============ AUTH & USERS (#1) ==============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,          -- scrypt; null for SSO-provisioned accounts
  sso_subject TEXT,            -- OIDC/SAML subject when provisioned via SSO
  role TEXT NOT NULL CHECK(role IN ('admin','broker','buyer','approver','viewer')) DEFAULT 'viewer',
  person_id INTEGER REFERENCES people(id),  -- links a login to a directory person
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,      -- opaque random session id (stored hashed)
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============ ATTACHMENTS / DOCUMENT STORAGE (#9) ============================
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER REFERENCES spot_buys(id),
  kind TEXT NOT NULL CHECK(kind IN ('mill_cert','quote','commercial_invoice','packing_list','other')) DEFAULT 'other',
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'local',   -- 'local' | 's3' | 'blob'
  storage_key TEXT NOT NULL,               -- path/key within the store
  uploaded_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_spot_buy ON attachments(spot_buy_id);

-- ============ GOODS RECEIPT & 3-WAY MATCH (#13) ==============================
CREATE TABLE IF NOT EXISTS goods_receipts (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  po_id INTEGER REFERENCES purchase_orders(id),
  quantity_ordered REAL NOT NULL DEFAULT 0,
  quantity_received REAL NOT NULL DEFAULT 0,
  partial INTEGER NOT NULL DEFAULT 0,       -- 1 when this is a partial shipment
  invoice_number TEXT,
  invoice_amount REAL,
  po_amount REAL,
  match_status TEXT NOT NULL CHECK(match_status IN ('pending','matched','qty_variance','price_variance','both_variance')) DEFAULT 'pending',
  discrepancy_note TEXT,
  received_by_person_id INTEGER REFERENCES people(id),
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gr_spot_buy ON goods_receipts(spot_buy_id);

-- ============ SUPPLIER INVOICES (first-class 3-way match) ====================
-- Invoices are their own records (not a field on the receipt) so partial
-- invoices accumulate and the invoiced total is matched against the PO. The
-- unique index enforces duplicate-invoice-number detection per buy.
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id INTEGER PRIMARY KEY,
  spot_buy_id INTEGER NOT NULL REFERENCES spot_buys(id),
  po_id INTEGER REFERENCES purchase_orders(id),
  invoice_number TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  recorded_by_person_id INTEGER REFERENCES people(id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_unique
  ON supplier_invoices(spot_buy_id, lower(invoice_number));

-- ============ NOTIFICATION PREFERENCES + CHANNELS (#12) ======================
CREATE TABLE IF NOT EXISTS notification_channels (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('slack','teams','webhook','email')),
  target TEXT NOT NULL,          -- webhook URL or email address
  events TEXT NOT NULL DEFAULT '[]',  -- JSON array of event keys (empty = all)
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ============ SCHEDULED AUTOMATION (#6) ======================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('rfq_followup','approval_escalation')),
  spot_buy_id INTEGER REFERENCES spot_buys(id),
  ref_id INTEGER,               -- invite id or approval id, by kind
  run_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','done','cancelled')) DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON scheduled_jobs(status, run_at);

-- ============ RATE LIMITING (#5) =============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,          -- e.g. 'triggers:1.2.3.4'
  window_start INTEGER NOT NULL, -- epoch seconds, floored to window
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- ============ FX RATES (#11 multi-currency) ==================================
CREATE TABLE IF NOT EXISTS fx_rates (
  currency TEXT PRIMARY KEY,     -- ISO code
  rate_to_usd REAL NOT NULL,     -- 1 unit of currency = rate_to_usd USD
  updated_at TEXT NOT NULL
);

-- ============ LEAD CAPTURE (demo paywall) ====================================
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  source TEXT,                   -- which surface hit the wall (reserve/needs)
  created_at TEXT NOT NULL
);
