// Shared domain types for the Wovi Broker Console.
// These mirror the SQLite schema exactly; array fields are stored JSON-encoded.

export type NodeType = "org" | "person";

export type OrgKind = "buyer" | "supplier" | "broker" | "facility";
export type NeedKind = "supplier" | "facility" | "part" | "material" | "lane";
export type NeedStatus = "open" | "brokering" | "matched" | "closed";
export type Priority = "low" | "med" | "high";

export type PathStatus =
  | "proposed"
  | "outreach"
  | "awaiting_consent"
  | "consented"
  | "declined"
  | "dead";

export type EdgeKind =
  | "knows"
  | "sources_from"
  | "brokered_intro"
  | "supplies"
  | "introduced_by";

export type ConsentStatus = "none" | "one_sided" | "double_opt_in";

export type Channel = "whatsapp" | "wechat" | "phone" | "email" | "in_person";
export type Direction = "out" | "in";
export type OutreachOutcome =
  | "no_reply"
  | "interested"
  | "refused"
  | "corrected"
  | "consented";

export type ConsentSide = "requester" | "supplier";
export type ConsentRecordStatus = "pending" | "granted" | "refused" | "revoked";

export type OutcomeResult =
  | "consented_intro"
  | "declined"
  | "dead_end"
  | "sourced"
  | "corrected";

export interface Organization {
  id: number;
  name: string;
  kind: OrgKind;
  country: string | null;
  region: string | null;
  materials: string[]; // parsed from JSON
  capabilities: string[]; // parsed from JSON
  notes: string | null;
  created_at: string;
}

export interface Person {
  id: number;
  name: string;
  org_id: number | null;
  title: string | null;
  whatsapp: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Need {
  id: number;
  title: string;
  kind: NeedKind;
  description: string | null;
  material_tag: string | null;
  target_region: string | null;
  requester_org_id: number | null;
  requester_person_id: number | null;
  status: NeedStatus;
  priority: Priority;
  created_at: string;
  closed_at: string | null;
}

export interface Path {
  id: number;
  need_id: number;
  target_org_id: number | null;
  connector_person_id: number | null;
  rationale: string | null;
  status: PathStatus;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface PathHop {
  id: number;
  path_id: number;
  position: number;
  node_type: NodeType;
  node_id: number;
}

export interface Edge {
  id: number;
  source_type: NodeType;
  source_id: number;
  target_type: NodeType;
  target_id: number;
  kind: EdgeKind;
  confidence: number;
  consent_status: ConsentStatus;
  provenance: string | null;
  evidence_note: string | null;
  first_seen_at: string;
  last_confirmed_at: string | null;
}

export interface Outreach {
  id: number;
  path_id: number | null;
  edge_id: number | null;
  channel: Channel;
  direction: Direction;
  person_id: number | null;
  summary: string;
  outcome: OutreachOutcome | null;
  occurred_at: string;
}

export interface Consent {
  id: number;
  path_id: number | null;
  edge_id: number | null;
  person_id: number;
  side: ConsentSide;
  status: ConsentRecordStatus;
  note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface Outcome {
  id: number;
  path_id: number | null;
  edge_id: number | null;
  result: OutcomeResult;
  confidence_delta: number;
  note: string | null;
  created_at: string;
}

// Convenience composite type for any graph node (org or person).
export interface GraphNodeRef {
  type: NodeType;
  id: number;
}

export function nodeKey(type: NodeType, id: number): string {
  return `${type}:${id}`;
}
