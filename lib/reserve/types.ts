// Reserve — Spot-Buy Execution Engine domain types. Mirror schema.sql exactly.

export type SpotBuyTrigger =
  | "mrp_exception"
  | "quality_rejection"
  | "line_down"
  | "shortage"
  | "volume_change"
  | "force_majeure";

export type Urgency = "low" | "med" | "high" | "critical";

export type Metal = "none" | "steel" | "aluminum";

// The 7-stage pipeline, mapped to the spec's stages.
export type SpotBuyStatus =
  | "triage" // 1. Need identified / flagged
  | "sourcing" // 2. Source / broadcast RFQ
  | "quoting" // 3. Compare quotes / select
  | "requisition" // 4. Requisition
  | "approval" // 5. DOA approval
  | "po" // 6. PO creation / release
  | "receiving" // 7. Goods receipt / 3-way match
  | "closed" // 8. Matched / done
  | "cancelled";

export interface SpotBuy {
  id: number;
  ref: string;
  title: string;
  material_number: string | null;
  material_desc: string | null;
  quantity: number;
  uom: string | null;
  required_by: string | null;
  cost_center: string | null;
  plant: string | null;
  trigger: SpotBuyTrigger;
  urgency: Urgency;
  downtime_cost_per_hour: number;
  buyer_org_id: number | null;
  buyer_person_id: number | null;
  cross_border: number; // 0/1
  metal: Metal;
  ship_from_country: string | null;
  ship_to_country: string | null;
  incoterm: string | null;
  status: SpotBuyStatus;
  urgency_confirmed: number; // 0/1
  base_currency: string;
  version: number;
  created_at: string;
  closed_at: string | null;
}

export type RfqStatus = "draft" | "sent" | "closed";

export interface Rfq {
  id: number;
  spot_buy_id: number;
  draft_body: string | null;
  status: RfqStatus;
  approved_by_person_id: number | null;
  sent_at: string | null;
  created_at: string;
}

export type InviteChannel = "email" | "phone" | "portal" | "edi";
export type InviteStatus =
  | "invited"
  | "followed_up"
  | "quoted"
  | "declined"
  | "no_reply";

export interface RfqInvite {
  id: number;
  rfq_id: number;
  spot_buy_id: number;
  supplier_org_id: number;
  supplier_person_id: number | null;
  channel: InviteChannel;
  status: InviteStatus;
  follow_up_count: number;
  invited_at: string;
  last_followed_up_at: string | null;
}

export type FreightMode =
  | "air"
  | "expedited_ground"
  | "sea"
  | "courier"
  | "standard";
export type QuoteFormat = "pdf" | "excel" | "email" | "phone";

export interface Quote {
  id: number;
  spot_buy_id: number;
  rfq_invite_id: number | null;
  supplier_org_id: number;
  supplier_person_id: number | null;
  unit_price: number;
  currency: string;
  quantity: number;
  lead_time_days: number;
  moq: number | null;
  freight_cost: number;
  freight_mode: FreightMode | null;
  incoterm: string | null;
  valid_until: string | null;
  source_format: QuoteFormat | null;
  notes: string | null;
  selected: number; // 0/1
  received_at: string;
}

export type RequisitionStatus = "draft" | "submitted";

export interface Requisition {
  id: number;
  spot_buy_id: number;
  quote_id: number | null;
  material_number: string | null;
  material_desc: string | null;
  quantity: number;
  uom: string | null;
  cost_center: string | null;
  need_by: string | null;
  supplier_org_id: number | null;
  unit_price: number;
  freight_cost: number;
  total_value: number;
  total_value_base: number;
  currency: string;
  missing_fields: string | null; // JSON array
  status: RequisitionStatus;
  submitted_by_person_id: number | null;
  created_at: string;
  submitted_at: string | null;
}

export interface DoaRule {
  id: number;
  role: string;
  min_amount: number;
  max_amount: number | null;
  approver_person_id: number | null;
  org_id: number | null;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "escalated";

export interface Approval {
  id: number;
  spot_buy_id: number;
  requisition_id: number | null;
  level: number;
  approver_person_id: number | null;
  role: string | null;
  threshold_min: number | null;
  threshold_max: number | null;
  amount: number;
  status: ApprovalStatus;
  escalated_to_person_id: number | null;
  note: string | null;
  created_at: string;
  decided_at: string | null;
}

export type PoStatus = "drafted" | "released" | "acknowledged" | "closed";

export interface PurchaseOrder {
  id: number;
  spot_buy_id: number;
  requisition_id: number | null;
  po_number: string;
  supplier_org_id: number | null;
  currency: string;
  total_value: number;
  incoterm: string | null;
  status: PoStatus;
  drafted_at: string;
  released_at: string | null;
  released_by_person_id: number | null;
  acknowledged_at: string | null;
}

export interface PoLine {
  id: number;
  po_id: number;
  line_no: number;
  description: string | null;
  quantity: number;
  uom: string | null;
  unit_price: number;
  amount: number;
}

export type CommercialInvoiceStatus = "missing" | "drafted" | "attached";
export type MillCertStatus = "missing" | "requested" | "received" | "verified";
export type CustomsStatus =
  | "not_required"
  | "assembling"
  | "ready"
  | "verified"
  | "hold";

export interface CustomsPacket {
  id: number;
  spot_buy_id: number;
  po_id: number | null;
  required: number; // 0/1
  metal: Metal;
  hs_code: string | null;
  country_of_melt_pour: string | null;
  country_of_smelt_cast: string | null;
  commercial_invoice_status: CommercialInvoiceStatus;
  mill_cert_status: MillCertStatus;
  broker_person_id: number | null;
  status: CustomsStatus;
  created_at: string;
  verified_at: string | null;
}

export type AuditActor = "ai" | "human" | "system";

export interface AuditEvent {
  id: number;
  spot_buy_id: number;
  actor: AuditActor;
  actor_person_id: number | null;
  stage: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

// The pipeline stages in order, for UI + progression.
export const PIPELINE: {
  key: SpotBuyStatus;
  label: string;
  n: string;
}[] = [
  { key: "triage", label: "Triage", n: "1" },
  { key: "sourcing", label: "Broadcast RFQ", n: "2" },
  { key: "quoting", label: "Compare quotes", n: "3" },
  { key: "requisition", label: "Requisition", n: "4" },
  { key: "approval", label: "DOA approval", n: "5" },
  { key: "po", label: "PO release", n: "6" },
  { key: "receiving", label: "Receipt & match", n: "7" },
  { key: "closed", label: "Closed", n: "8" },
];
