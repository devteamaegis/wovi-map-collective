// Zero-dependency test runner for the pure Reserve logic (#14). Node 20 can't
// strip TS types, so we transpile the target modules on the fly with the already
// installed `typescript` compiler, then import + assert. Tests the REAL source
// (logic.ts, parse.ts, audit.ts, erp/formats.ts) — no drift, no extra deps.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wovi-test-"));

async function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  const file = path.join(tmp, rel.replace(/[\/]/g, "__").replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(file, out);
  return import(pathToFileURL(file).href);
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n     ${e.message}`);
  }
}

const logic = await load("lib/reserve/logic.ts");
const parse = await load("lib/reserve/parse.ts");
const audit = await load("lib/reserve/audit.ts");
const formats = await load("lib/erp/formats.ts");

console.log("\n3-way match (#13)");
test("clean match", () => {
  assert.equal(logic.threeWayMatch({ qtyOrdered: 100, qtyReceived: 100, poAmount: 1000, invoiceAmount: 1000 }), "matched");
});
test("quantity variance", () => {
  assert.equal(logic.threeWayMatch({ qtyOrdered: 100, qtyReceived: 80, poAmount: 1000, invoiceAmount: 1000 }), "qty_variance");
});
test("price variance", () => {
  assert.equal(logic.threeWayMatch({ qtyOrdered: 100, qtyReceived: 100, poAmount: 1000, invoiceAmount: 1200 }), "price_variance");
});
test("both variance", () => {
  assert.equal(logic.threeWayMatch({ qtyOrdered: 100, qtyReceived: 50, poAmount: 1000, invoiceAmount: 1500 }), "both_variance");
});
test("within tolerance is matched", () => {
  assert.equal(logic.threeWayMatch({ qtyOrdered: 100, qtyReceived: 101, poAmount: 1000, invoiceAmount: 1010 }), "matched");
});

console.log("\nDOA routing (#1)");
const rules = [
  { role: "Cat Mgr", min_amount: 0, max_amount: 50000, approver_person_id: 1 },
  { role: "Proc Dir", min_amount: 50000, max_amount: 250000, approver_person_id: 2 },
  { role: "VP", min_amount: 250000, max_amount: 1000000, approver_person_id: 3 },
  { role: "CFO", min_amount: 1000000, max_amount: null, approver_person_id: 4 },
];
test("routes 64,600 → Proc Dir", () => assert.equal(logic.matchDoaRule(rules, 64600).role, "Proc Dir"));
test("routes 395,000 → VP", () => assert.equal(logic.matchDoaRule(rules, 395000).role, "VP"));
test("routes 2,000,000 → CFO", () => assert.equal(logic.matchDoaRule(rules, 2000000).role, "CFO"));
test("routes 0 → Cat Mgr", () => assert.equal(logic.matchDoaRule(rules, 0).role, "Cat Mgr"));

console.log("\nQuote ranking (#3)");
test("landed total = price*qty + freight", () => {
  assert.equal(logic.landedTotal({ unit_price: 2, quantity: 100, freight_cost: 50 }), 250);
});
test("recommends best value, flags cheapest/fastest", () => {
  const q = (id, up, qty, fr, lead) => ({ id, unit_price: up, quantity: qty, freight_cost: fr, lead_time_days: lead });
  const ranked = logic.rankQuotes([q(1, 1.0, 100, 40, 10), q(2, 1.1, 100, 10, 3), q(3, 0.9, 100, 60, 20)]);
  assert.ok(ranked[0].recommended, "first is recommended");
  assert.equal(ranked.filter((r) => r.isCheapest).length, 1);
  assert.equal(ranked.filter((r) => r.isFastest).length, 1);
});

console.log("\nAudit hash-chain (#5)");
const f1 = { spot_buy_id: 1, actor: "human", actor_person_id: 2, stage: "triage", action: "x", detail: null, created_at: "2026-01-01T00:00:00Z" };
test("deterministic", () => assert.equal(audit.auditHash(null, f1), audit.auditHash(null, f1)));
test("changes when a field changes", () => {
  assert.notEqual(audit.auditHash(null, f1), audit.auditHash(null, { ...f1, action: "y" }));
});
test("changes when prev hash changes (chaining)", () => {
  assert.notEqual(audit.auditHash(null, f1), audit.auditHash("abc", f1));
});

console.log("\nHeuristic quote parser (#3)");
test("extracts price/qty/lead/freight/currency/incoterm", () => {
  const r = parse.heuristicParseQuote("Unit price $1.12 per kg\nQuantity 60,000 kg\nLead time 7 days\nAir freight $26,000\nDAP");
  assert.equal(r.unit_price, 1.12);
  assert.equal(r.quantity, 60000);
  assert.equal(r.lead_time_days, 7);
  assert.equal(r.freight_cost, 26000);
  assert.equal(r.currency, "USD");
  assert.equal(r.incoterm, "DAP");
});
test("converts weeks to days", () => {
  const r = parse.heuristicParseQuote("lead time 2 weeks");
  assert.equal(r.lead_time_days, 14);
});
test("detects EUR", () => {
  const r = parse.heuristicParseQuote("Price EUR 3.40 per unit");
  assert.equal(r.currency, "EUR");
});
test("parses a single comma-separated line (real-email shape)", () => {
  const r = parse.heuristicParseQuote("Unit price $1.18 per kg, quantity 40000 kg, lead time 5 days, expedited freight $18000, DAP");
  assert.equal(r.unit_price, 1.18);
  assert.equal(r.quantity, 40000);
  assert.equal(r.lead_time_days, 5);
  assert.equal(r.freight_cost, 18000);
  assert.equal(r.incoterm, "DAP");
});
test("parses the app's advertised '/kg' + bare-quantity format", () => {
  const r = parse.heuristicParseQuote("$1.12/kg, 60,000 kg, 7 days, air freight $26,000, DAP");
  assert.equal(r.unit_price, 1.12);
  assert.equal(r.quantity, 60000);
  assert.equal(r.lead_time_days, 7);
  assert.equal(r.freight_cost, 26000);
  assert.equal(r.incoterm, "DAP");
});
test("handles EU decimal format (1.234,56)", () => {
  const r = parse.heuristicParseQuote("unit price 1.234,56 per unit");
  assert.equal(r.unit_price, 1234.56);
});
test("word-boundary: 'each' inside 'reach' does not steal a number", () => {
  const r = parse.heuristicParseQuote("reach out by 3pm; unit price 5");
  assert.equal(r.unit_price, 5);
});
test("lead time ignores the validity window", () => {
  const r = parse.heuristicParseQuote("Quote valid for 30 days, lead 2 weeks");
  assert.equal(r.lead_time_days, 14);
});

console.log("\nERP formats (#7)");
const poDoc = {
  po_number: "PO-2026-4501", currency: "USD", total_value: 93200, incoterm: "DAP", released_at: "2026-07-01T00:00:00Z",
  buyer: "Voltaic", supplier: "Volga", supplier_country: "TR", plant: "Leipzig", cost_center: "CC-4021",
  lines: [{ line_no: 1, material_number: "STL-HR", description: "Steel coil", quantity: 60000, uom: "kg", unit_price: 1.12, amount: 67200 }],
};
test("EDI 850 has ST/BEG/PO1/SE segments + PO number", () => {
  const edi = formats.poToEdi850(poDoc);
  assert.ok(edi.includes("ST*850"));
  assert.ok(edi.includes("BEG*00*NE*PO-2026-4501"));
  assert.ok(edi.includes("PO1*1*60000"));
  assert.ok(edi.includes("SE*"));
});
test("cXML is well-formed OrderRequest", () => {
  const x = formats.poToCxml(poDoc);
  assert.ok(x.startsWith("<?xml"));
  assert.ok(x.includes("<OrderRequest>"));
  assert.ok(x.includes("PO-2026-4501"));
  assert.ok(x.includes('currency="USD"'));
});
test("EDI 850 sanitizes delimiter injection in field values", () => {
  const evil = { ...poDoc, supplier: "Acme*Corp~Evil", lines: [{ ...poDoc.lines[0], description: "steel~coil*x" }] };
  const edi = formats.poToEdi850(evil);
  // The N1*SE supplier segment must not contain the raw injected * or ~.
  const seLine = edi.split("\n").find((l) => l.startsWith("N1*SE"));
  assert.ok(!seLine.includes("Acme*Corp"), "supplier '*' not sanitized");
  assert.ok(!seLine.includes("Corp~Evil"), "supplier '~' not sanitized");
  // Structure intact: exactly one ST, one SE, one PO1 (segment-leading).
  const segs = edi.split("\n");
  assert.equal(segs.filter((l) => l.startsWith("ST*850")).length, 1);
  assert.equal(segs.filter((l) => l.startsWith("SE*")).length, 1);
  assert.equal(segs.filter((l) => l.startsWith("PO1*")).length, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
