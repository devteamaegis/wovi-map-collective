"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { gateRun, recordRun } from "@/lib/paywall";
import {
  createNeed,
  setNeedStatus,
  deleteNeed,
} from "@/lib/repos/needs";
import {
  createPath,
  setPathStatus,
} from "@/lib/repos/paths";
import { addOutreach } from "@/lib/repos/outreach";
import {
  ensurePathConsents,
  decideConsent,
} from "@/lib/repos/consents";
import {
  createOrg,
  updateOrg,
  deleteOrg,
} from "@/lib/repos/orgs";
import {
  createPerson,
  updatePerson,
  deletePerson,
} from "@/lib/repos/people";
import { createEdge } from "@/lib/repos/edges";
import type {
  NeedKind,
  Priority,
  OrgKind,
  NodeType,
  EdgeKind,
  ConsentStatus,
  ConsentRecordStatus,
  PathStatus,
  Channel,
  Direction,
  OutreachOutcome,
} from "@/lib/types";

// Revalidate every route segment so dashboard, graph, directory, etc. all reflect
// the change. (Single-user local tool — correctness over granularity.)
function revalidateEverything() {
  revalidatePath("/", "layout");
}

function asList(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ----------------------------------------------------------------- NEEDS

export async function createNeedAction(formData: FormData) {
  // Anonymous demo visitors are metered; signed-in users never are.
  const authed = (await currentUser()) != null;
  if (!authed) {
    const gate = await gateRun();
    if (!gate.allowed) redirect("/unlock?from=needs");
  }
  const id = createNeed({
    title: String(formData.get("title") || "").trim(),
    kind: (formData.get("kind") as NeedKind) || "supplier",
    description: (formData.get("description") as string) || null,
    material_tag: ((formData.get("material_tag") as string) || "").trim() || null,
    target_region: ((formData.get("target_region") as string) || "").trim() || null,
    requester_org_id: numOrNull(formData.get("requester_org_id")),
    requester_person_id: numOrNull(formData.get("requester_person_id")),
    priority: (formData.get("priority") as Priority) || "med",
  });
  if (!authed) await recordRun();
  revalidateEverything();
  redirect(`/needs/${id}`);
}

export async function setNeedStatusAction(
  needId: number,
  status: "open" | "brokering" | "matched" | "closed"
) {
  setNeedStatus(needId, status);
  revalidateEverything();
}

export async function deleteNeedAction(needId: number) {
  deleteNeed(needId);
  revalidateEverything();
  redirect("/needs");
}

// ----------------------------------------------------------------- PATHS

export interface PromotePathInput {
  need_id: number;
  target_org_id: number | null;
  connector_person_id: number | null;
  rationale: string | null;
  hops: { type: NodeType; id: number }[];
}

export async function promotePathAction(input: PromotePathInput) {
  const id = createPath({
    need_id: input.need_id,
    target_org_id: input.target_org_id,
    connector_person_id: input.connector_person_id,
    rationale: input.rationale,
    status: "proposed",
    hops: input.hops,
  });
  setNeedStatus(input.need_id, "brokering");
  revalidateEverything();
  return id;
}

export async function setPathStatusAction(pathId: number, status: PathStatus) {
  setPathStatus(pathId, status);
  revalidateEverything();
}

// --------------------------------------------------------------- OUTREACH

export interface AddOutreachInput {
  path_id: number | null;
  edge_id: number | null;
  channel: Channel;
  direction: Direction;
  person_id: number | null;
  summary: string;
  outcome: OutreachOutcome | null;
}

export async function addOutreachAction(input: AddOutreachInput) {
  addOutreach(input);
  revalidateEverything();
}

// --------------------------------------------------------------- CONSENT

export async function ensureConsentsAction(pathId: number) {
  ensurePathConsents(pathId);
  revalidateEverything();
}

export async function decideConsentAction(
  consentId: number,
  status: ConsentRecordStatus,
  note?: string | null
) {
  const result = decideConsent(consentId, status, note ?? null);
  revalidateEverything();
  return result;
}

// ------------------------------------------------------------------ ORGS

export async function createOrgAction(formData: FormData) {
  const id = createOrg({
    name: String(formData.get("name") || "").trim(),
    kind: (formData.get("kind") as OrgKind) || "supplier",
    country: ((formData.get("country") as string) || "").trim() || null,
    region: ((formData.get("region") as string) || "").trim() || null,
    materials: asList(formData.get("materials")),
    capabilities: asList(formData.get("capabilities")),
    notes: ((formData.get("notes") as string) || "").trim() || null,
  });
  revalidateEverything();
  redirect(`/directory/org/${id}`);
}

export async function updateOrgAction(formData: FormData) {
  const id = Number(formData.get("id"));
  updateOrg(id, {
    name: String(formData.get("name") || "").trim(),
    kind: (formData.get("kind") as OrgKind) || "supplier",
    country: ((formData.get("country") as string) || "").trim() || null,
    region: ((formData.get("region") as string) || "").trim() || null,
    materials: asList(formData.get("materials")),
    capabilities: asList(formData.get("capabilities")),
    notes: ((formData.get("notes") as string) || "").trim() || null,
  });
  revalidateEverything();
  redirect(`/directory/org/${id}`);
}

export async function deleteOrgAction(orgId: number) {
  deleteOrg(orgId);
  revalidateEverything();
  redirect("/directory");
}

// ---------------------------------------------------------------- PEOPLE

export async function createPersonAction(formData: FormData) {
  const id = createPerson({
    name: String(formData.get("name") || "").trim(),
    org_id: numOrNull(formData.get("org_id")),
    title: ((formData.get("title") as string) || "").trim() || null,
    whatsapp: ((formData.get("whatsapp") as string) || "").trim() || null,
    wechat: ((formData.get("wechat") as string) || "").trim() || null,
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
  });
  revalidateEverything();
  redirect(`/directory/person/${id}`);
}

export async function updatePersonAction(formData: FormData) {
  const id = Number(formData.get("id"));
  updatePerson(id, {
    name: String(formData.get("name") || "").trim(),
    org_id: numOrNull(formData.get("org_id")),
    title: ((formData.get("title") as string) || "").trim() || null,
    whatsapp: ((formData.get("whatsapp") as string) || "").trim() || null,
    wechat: ((formData.get("wechat") as string) || "").trim() || null,
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
  });
  revalidateEverything();
  redirect(`/directory/person/${id}`);
}

export async function deletePersonAction(personId: number) {
  deletePerson(personId);
  revalidateEverything();
  redirect("/directory");
}

// ------------------------------------------------------------------ EDGES

export interface CreateEdgeInput {
  source_type: NodeType;
  source_id: number;
  target_type: NodeType;
  target_id: number;
  kind: EdgeKind;
  consent_status: ConsentStatus;
  provenance?: string | null;
  evidence_note?: string | null;
}

export async function createEdgeAction(input: CreateEdgeInput) {
  const id = createEdge(input);
  revalidateEverything();
  return id;
}

// --------------------------------------------------- BROKER THIS (from /ask)

export interface BrokerThisInput {
  title: string;
  kind: NeedKind;
  description: string | null;
  material_tag: string | null;
  target_region: string | null;
  requester_org_id: number | null;
  requester_person_id: number | null;
  priority: Priority;
  target_org_id: number | null;
  connector_person_id: number | null;
  rationale: string | null;
  hops: { type: NodeType; id: number }[];
}

export async function brokerThisAction(input: BrokerThisInput) {
  const needId = createNeed({
    title: input.title,
    kind: input.kind,
    description: input.description,
    material_tag: input.material_tag,
    target_region: input.target_region,
    requester_org_id: input.requester_org_id,
    requester_person_id: input.requester_person_id,
    priority: input.priority,
  });
  createPath({
    need_id: needId,
    target_org_id: input.target_org_id,
    connector_person_id: input.connector_person_id,
    rationale: input.rationale,
    status: "proposed",
    hops: input.hops,
  });
  setNeedStatus(needId, "brokering");
  revalidateEverything();
  redirect(`/needs/${needId}`);
}
