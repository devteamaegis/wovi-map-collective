// Reserve seed — spot-buy scenarios spanning every trigger, urgency, and pipeline
// stage, plus a few fully-worked end-to-end examples. Runs inside the main seed
// transaction with the shared org/person ref maps. Timestamps are hours-scale
// (spot buys move in hours, not weeks).

export function seedReserve(db, ctx) {
  const { orgId, personId, NOW } = ctx;
  const NOW_MS = new Date(NOW).getTime();
  const HOUR = 1000 * 60 * 60;
  const hAgo = (h) => new Date(NOW_MS - h * HOUR).toISOString();

  // --- new metals suppliers (steel/aluminum have no seed supplier otherwise) ---
  const insOrg = db.prepare(
    `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const addOrg = (ref, name, country, region, materials, caps, notes) => {
    const info = insOrg.run(
      name,
      "supplier",
      country,
      region,
      JSON.stringify(materials),
      JSON.stringify(caps),
      notes,
      hAgo(24 * 60)
    );
    orgId[ref] = Number(info.lastInsertRowid);
  };
  addOrg("rustbelt", "Rustbelt Steel Works", "United States", "North America", ["steel", "hot-rolled coil", "steel coil"], ["hot rolling", "coil"], "Domestic hot-rolled steel coil.");
  addOrg("volga", "Volga Steelworks", "Turkey", "Europe", ["steel", "steel coil", "plate"], ["rolling"], "Cross-border steel; Section 232 melt/pour docs.");
  addOrg("nordal", "Nordal Aluminium", "Norway", "Europe", ["aluminum", "aluminum plate", "ams aluminum"], ["casting", "plate"], "Aerospace-grade aluminum plate.");

  const insPerson = db.prepare(
    `INSERT INTO people (name,org_id,title,whatsapp,wechat,phone,email,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const addPerson = (ref, name, orgRef, title, email) => {
    const info = insPerson.run(name, orgId[orgRef] ?? null, title, null, null, null, email, null, hAgo(24 * 60));
    personId[ref] = Number(info.lastInsertRowid);
  };
  addPerson("hank", "Hank Dolan", "rustbelt", "Sales Director", "hank@rustbeltsteel.com");
  addPerson("emre", "Emre Yılmaz", "volga", "Export Manager", "emre@volgasteel.com.tr");
  addPerson("sigrid", "Sigrid Haugen", "nordal", "Commercial Manager", "sigrid@nordal.no");
  addPerson("evelyn", "Evelyn Cho", "wovi", "CFO — approval authority", "evelyn@wovi.io");

  // --- approved-supplier edges (so candidates show as "approved") ---
  const insEdge = db.prepare(
    `INSERT INTO edges (source_type,source_id,target_type,target_id,kind,confidence,consent_status,provenance,evidence_note,first_seen_at,last_confirmed_at)
     VALUES ('org',?,'org',?,?,?,?,?,?,?,?)`
  );
  const supplyEdge = (supRef, buyerRef, conf, consent) =>
    insEdge.run(orgId[supRef], orgId[buyerRef], "supplies", conf, consent, "Approved supplier", "On the approved vendor master.", hAgo(24 * 300), hAgo(24 * 20));
  supplyEdge("rustbelt", "voltaic", 72, "double_opt_in");
  supplyEdge("volga", "voltaic", 58, "one_sided");
  supplyEdge("nordal", "meridian", 75, "double_opt_in");

  // --- DOA matrix (delegation of authority by dollar threshold) ---
  const insDoa = db.prepare(
    "INSERT INTO doa_rules (role,min_amount,max_amount,approver_person_id,org_id) VALUES (?,?,?,?,?)"
  );
  insDoa.run("Category Manager", 0, 50000, personId["priya"], null);
  insDoa.run("Procurement Director", 50000, 250000, personId["george"], null);
  insDoa.run("VP Supply Chain", 250000, 1000000, personId["marcus"], null);
  insDoa.run("CFO", 1000000, null, personId["evelyn"], null);

  // --- insert helpers ---
  const insSpot = db.prepare(
    `INSERT INTO spot_buys (ref,title,material_number,material_desc,quantity,uom,required_by,cost_center,plant,trigger,urgency,downtime_cost_per_hour,buyer_org_id,buyer_person_id,cross_border,metal,ship_from_country,ship_to_country,incoterm,status,urgency_confirmed,created_at,closed_at)
     VALUES (@ref,@title,@mn,@md,@qty,@uom,@rb,@cc,@plant,@trig,@urg,@dt,@bo,@bp,@cb,@metal,@sf,@st,@inc,@status,@uc,@created,@closed)`
  );
  const insRfq = db.prepare(
    "INSERT INTO rfqs (spot_buy_id,draft_body,status,approved_by_person_id,sent_at,created_at) VALUES (?,?,?,?,?,?)"
  );
  const insInvite = db.prepare(
    "INSERT INTO rfq_invites (rfq_id,spot_buy_id,supplier_org_id,supplier_person_id,channel,status,follow_up_count,invited_at,last_followed_up_at) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  const insQuote = db.prepare(
    "INSERT INTO quotes (spot_buy_id,rfq_invite_id,supplier_org_id,supplier_person_id,unit_price,currency,quantity,lead_time_days,moq,freight_cost,freight_mode,incoterm,valid_until,source_format,notes,selected,received_at) VALUES (@sb,@inv,@sup,@sp,@up,'USD',@qty,@lt,@moq,@fr,@fm,@inc,@vu,@sf,@notes,@sel,@rec)"
  );
  const insReq = db.prepare(
    "INSERT INTO requisitions (spot_buy_id,quote_id,material_number,material_desc,quantity,uom,cost_center,need_by,supplier_org_id,unit_price,freight_cost,total_value,currency,missing_fields,status,created_at,submitted_at) VALUES (@sb,@qid,@mn,@md,@qty,@uom,@cc,@nb,@sup,@up,@fr,@tv,'USD',@mf,@status,@created,@sub)"
  );
  const insApproval = db.prepare(
    "INSERT INTO approvals (spot_buy_id,requisition_id,level,approver_person_id,role,threshold_min,threshold_max,amount,status,escalated_to_person_id,note,created_at,decided_at) VALUES (@sb,@req,@lvl,@ap,@role,@min,@max,@amt,@status,@esc,@note,@created,@decided)"
  );
  const insPo = db.prepare(
    "INSERT INTO purchase_orders (spot_buy_id,requisition_id,po_number,supplier_org_id,currency,total_value,incoterm,status,drafted_at,released_at,released_by_person_id,acknowledged_at) VALUES (@sb,@req,@po,@sup,'USD',@tv,@inc,@status,@drafted,@released,@rb,@ack)"
  );
  const insPoLine = db.prepare(
    "INSERT INTO po_lines (po_id,line_no,description,quantity,uom,unit_price,amount) VALUES (?,?,?,?,?,?,?)"
  );
  const insCustoms = db.prepare(
    "INSERT INTO customs_packets (spot_buy_id,po_id,required,metal,hs_code,country_of_melt_pour,country_of_smelt_cast,commercial_invoice_status,mill_cert_status,broker_person_id,status,created_at,verified_at) VALUES (@sb,@po,@req,@metal,@hs,@melt,@smelt,@ci,@mc,@bk,@status,@created,@verified)"
  );
  const insAudit = db.prepare(
    "INSERT INTO audit_events (spot_buy_id,actor,actor_person_id,stage,action,detail,created_at) VALUES (?,?,?,?,?,?,?)"
  );
  const audit = (sb, actor, pid, stage, action, detail, h) =>
    insAudit.run(sb, actor, pid ?? null, stage, action, detail, hAgo(h));

  let refN = 1041;
  const spot = (o) => {
    const id = Number(
      insSpot.run({
        ref: `SB-${refN++}`,
        title: o.title,
        mn: o.mn ?? null,
        md: o.md ?? null,
        qty: o.qty,
        uom: o.uom ?? null,
        rb: o.rb ?? null,
        cc: o.cc ?? null,
        plant: o.plant ?? null,
        trig: o.trig,
        urg: o.urg,
        dt: o.dt,
        bo: orgId[o.buyer],
        bp: personId[o.buyerP],
        cb: o.cb ? 1 : 0,
        metal: o.metal ?? "none",
        sf: o.sf ?? null,
        st: o.st ?? null,
        inc: o.inc ?? null,
        status: o.status,
        uc: o.uc ? 1 : 0,
        created: hAgo(o.createdH),
        closed: o.closedH != null ? hAgo(o.closedH) : null,
      }).lastInsertRowid
    );
    return id;
  };

  // ============ SB-1041 — fully worked, CLOSED, cross-border steel ============
  {
    const sb = spot({ title: "Hot-rolled steel coil — stamping line down", mn: "STL-HR-3.0-1250", md: "Hot-rolled steel coil, 3.0mm × 1250mm", qty: 60, uom: "t", rb: hAgo(-18), cc: "CC-4021", plant: "Voltaic Leipzig — Body Shop", trig: "line_down", urg: "critical", dt: 2300000, buyer: "voltaic", buyerP: "tomas", cb: true, metal: "steel", sf: "Turkey", st: "Germany", inc: "DAP", status: "closed", uc: true, createdH: 9, closedH: 2 });
    const rfq = Number(insRfq.run(sb, "Urgent RFQ — hot-rolled steel coil (SB-1041) … [AI-drafted, sent]", "sent", personId["tomas"], hAgo(8.5), hAgo(8.7)).lastInsertRowid);
    const inv1 = Number(insInvite.run(rfq, sb, orgId["rustbelt"], personId["hank"], "email", "quoted", 1, hAgo(8.4), hAgo(7)).lastInsertRowid);
    const inv2 = Number(insInvite.run(rfq, sb, orgId["volga"], personId["emre"], "email", "quoted", 0, hAgo(8.4), null).lastInsertRowid);
    insQuote.run({ sb, inv: inv1, sup: orgId["rustbelt"], sp: personId["hank"], up: 1.28, qty: 60, lt: 9, moq: 30, fr: 21000, fm: "expedited_ground", inc: "DAP", vu: hAgo(-72), sf: "pdf", notes: "Domestic — no customs.", sel: 0, rec: hAgo(6.5) });
    const qSel = Number(insQuote.run({ sb, inv: inv2, sup: orgId["volga"], sp: personId["emre"], up: 1.12, qty: 60, lt: 7, moq: 30, fr: 26000, fm: "air", inc: "DAP", vu: hAgo(-72), sf: "excel", notes: "Section 232 mill cert included.", sel: 1, rec: hAgo(6) }).lastInsertRowid);
    const total = 1.12 * 60 * 1000 + 26000; // price per t? treat unit as $/t*qty(t)? keep unit as $/kg, qty t -> convert: use 60t=60000kg. Simplify: total below.
    const tv = Math.round(1.12 * 60000 + 26000);
    const req = Number(insReq.run({ sb, qid: qSel, mn: "STL-HR-3.0-1250", md: "Hot-rolled steel coil, 3.0mm × 1250mm", qty: 60000, uom: "kg", cc: "CC-4021", nb: hAgo(-18), sup: orgId["volga"], up: 1.12, fr: 26000, tv, mf: "[]", status: "submitted", created: hAgo(5.5), sub: hAgo(5) }).lastInsertRowid);
    insApproval.run({ sb, req, lvl: 1, ap: personId["george"], role: "Procurement Director", min: 50000, max: 250000, amt: tv, status: "approved", esc: null, note: "Cleared against line-down exposure.", created: hAgo(5), decided: hAgo(4.2) });
    const po = Number(insPo.run({ sb, req, po: "PO-2026-4541", sup: orgId["volga"], tv, inc: "DAP", status: "released", drafted: hAgo(4), released: hAgo(3.5), rb: personId["tomas"], ack: hAgo(3) }).lastInsertRowid);
    insPoLine.run(po, 1, "Hot-rolled steel coil, 3.0mm × 1250mm", 60000, "kg", 1.12, Math.round(1.12 * 60000));
    insPoLine.run(po, 2, "Expedited air freight", 1, "lot", 26000, 26000);
    insCustoms.run({ sb, po, req: 1, metal: "steel", hs: "7208.39", melt: "Turkey", smelt: null, ci: "attached", mc: "verified", bk: personId["fatima"], status: "verified", created: hAgo(3.4), verified: hAgo(2.2) });
    audit(sb, "human", personId["tomas"], "triage", "Spot buy logged", "SB-1041 — line down at Body Shop", 9);
    audit(sb, "human", personId["tomas"], "triage", "Urgency confirmed", "Critical — line stopped", 8.8);
    audit(sb, "ai", null, "sourcing", "RFQ drafted", "Drafted RFQ + selected 2 approved steel suppliers", 8.7);
    audit(sb, "human", personId["tomas"], "sourcing", "RFQ broadcast approved", "Sent to 2 approved suppliers", 8.5);
    audit(sb, "ai", null, "sourcing", "Follow-up sent", "Timed follow-up to Rustbelt Steel Works", 7);
    audit(sb, "ai", null, "quoting", "Quote parsed", "Volga Steelworks: $93,200 landed", 6);
    audit(sb, "human", personId["tomas"], "quoting", "Supplier selected", "Volga Steelworks on best value", 5.6);
    audit(sb, "ai", null, "requisition", "Requisition pre-filled", "All fields complete", 5.5);
    audit(sb, "human", personId["tomas"], "requisition", "Requisition submitted", null, 5);
    audit(sb, "system", null, "approval", "Routed for DOA approval", "Procurement Director — George Mensah", 5);
    audit(sb, "human", personId["george"], "approval", "Approval granted", "Released to PO", 4.2);
    audit(sb, "ai", null, "po", "PO drafted", "PO-2026-4541 in ERP format", 4);
    audit(sb, "human", personId["tomas"], "po", "PO released", "PO-2026-4541 released to supplier", 3.5);
    audit(sb, "ai", null, "closed", "Customs packet assembled", "HS 7208.39, melt/pour Turkey, mill cert requested", 3.4);
    audit(sb, "human", personId["fatima"], "closed", "Customs verified", "Broker verified mill certificate", 2.2);
    audit(sb, "system", null, "closed", "Spot buy closed", "Customs cleared", 2);
  }

  // ============ SB-1042 — PO released, customs assembling (aluminum) ==========
  {
    const sb = spot({ title: "Aerospace aluminum plate — lot rejected on quality", mn: "AL-7075-T651", md: "Aluminum plate 7075-T651, AMS-QQ-A-250/12", qty: 8000, uom: "kg", rb: hAgo(-30), cc: "CC-1180", plant: "Meridian Wichita — Structures", trig: "quality_rejection", urg: "high", dt: 45000, buyer: "meridian", buyerP: "priya", cb: true, metal: "aluminum", sf: "Norway", st: "United States", inc: "DAP", status: "po", uc: true, createdH: 6 });
    const rfq = Number(insRfq.run(sb, "Urgent RFQ — aluminum plate 7075-T651 (SB-1042) … [AI-drafted, sent]", "sent", personId["priya"], hAgo(5.5), hAgo(5.7)).lastInsertRowid);
    const inv1 = Number(insInvite.run(rfq, sb, orgId["nordal"], personId["sigrid"], "email", "quoted", 0, hAgo(5.4), null).lastInsertRowid);
    const inv2 = Number(insInvite.run(rfq, sb, orgId["carpathia"], personId["piotr"], "email", "quoted", 1, hAgo(5.4), hAgo(4)).lastInsertRowid);
    insQuote.run({ sb, inv: inv2, sup: orgId["carpathia"], sp: personId["piotr"], up: 6.4, qty: 8000, lt: 6, moq: 2000, fr: 9800, fm: "expedited_ground", inc: "DAP", vu: hAgo(-96), sf: "email", notes: null, sel: 0, rec: hAgo(4.2) });
    const qSel = Number(insQuote.run({ sb, inv: inv1, sup: orgId["nordal"], sp: personId["sigrid"], up: 6.1, qty: 8000, lt: 8, moq: 2000, fr: 12500, fm: "air", inc: "DAP", vu: hAgo(-96), sf: "pdf", notes: "AMS cert + smelt declaration.", sel: 1, rec: hAgo(3.8) }).lastInsertRowid);
    const tv = Math.round(6.1 * 8000 + 12500);
    const req = Number(insReq.run({ sb, qid: qSel, mn: "AL-7075-T651", md: "Aluminum plate 7075-T651", qty: 8000, uom: "kg", cc: "CC-1180", nb: hAgo(-30), sup: orgId["nordal"], up: 6.1, fr: 12500, tv, mf: "[]", status: "submitted", created: hAgo(3.4), sub: hAgo(3) }).lastInsertRowid);
    insApproval.run({ sb, req, lvl: 1, ap: personId["george"], role: "Procurement Director", min: 50000, max: 250000, amt: tv, status: "approved", esc: null, note: null, created: hAgo(3), decided: hAgo(2.4) });
    const po = Number(insPo.run({ sb, req, po: "PO-2026-4542", sup: orgId["nordal"], tv, inc: "DAP", status: "released", drafted: hAgo(2.2), released: hAgo(1.8), rb: personId["priya"], ack: null }).lastInsertRowid);
    insPoLine.run(po, 1, "Aluminum plate 7075-T651", 8000, "kg", 6.1, Math.round(6.1 * 8000));
    insPoLine.run(po, 2, "Expedited air freight", 1, "lot", 12500, 12500);
    insCustoms.run({ sb, po, req: 1, metal: "aluminum", hs: "7606.12", melt: null, smelt: "Norway", ci: "drafted", mc: "requested", bk: personId["fatima"], status: "ready", created: hAgo(1.6), verified: null });
    audit(sb, "human", personId["priya"], "triage", "Spot buy logged", "SB-1042 — quality rejection", 6);
    audit(sb, "ai", null, "quoting", "Quote parsed", "Nordal Aluminium: $61,300 landed", 3.8);
    audit(sb, "human", personId["priya"], "quoting", "Supplier selected", "Nordal on best value", 3.5);
    audit(sb, "human", personId["priya"], "requisition", "Requisition submitted", null, 3);
    audit(sb, "human", personId["george"], "approval", "Approval granted", "Released to PO", 2.4);
    audit(sb, "human", personId["priya"], "po", "PO released", "PO-2026-4542 released", 1.8);
    audit(sb, "ai", null, "closed", "Customs packet assembled", "HS 7606.12, smelt/cast Norway; awaiting broker verification", 1.6);
  }

  // ============ SB-1043 — awaiting DOA approval (connectors) ==================
  {
    const sb = spot({ title: "High-current board-to-board connectors — shortage", mn: "CONN-40A-BTB", md: "40A board-to-board connectors", qty: 24000, uom: "ea", rb: hAgo(-48), cc: "CC-2210", plant: "Nimbus Fremont — SMT", trig: "shortage", urg: "high", dt: 32000, buyer: "nimbus", buyerP: "sofia", cb: true, metal: "none", sf: "China", st: "United States", inc: "DAP", status: "approval", uc: true, createdH: 4 });
    const rfq = Number(insRfq.run(sb, "Urgent RFQ — 40A connectors (SB-1043) … [AI-drafted, sent]", "sent", personId["sofia"], hAgo(3.6), hAgo(3.8)).lastInsertRowid);
    const inv1 = Number(insInvite.run(rfq, sb, orgId["guangzhou"], personId["xiaolong"], "email", "quoted", 0, hAgo(3.5), null).lastInsertRowid);
    const qSel = Number(insQuote.run({ sb, inv: inv1, sup: orgId["guangzhou"], sp: personId["xiaolong"], up: 2.35, qty: 24000, lt: 10, moq: 10000, fr: 8200, fm: "air", inc: "DAP", vu: hAgo(-72), sf: "excel", notes: null, sel: 1, rec: hAgo(2.5) }).lastInsertRowid);
    const tv = Math.round(2.35 * 24000 + 8200);
    const req = Number(insReq.run({ sb, qid: qSel, mn: "CONN-40A-BTB", md: "40A board-to-board connectors", qty: 24000, uom: "ea", cc: "CC-2210", nb: hAgo(-48), sup: orgId["guangzhou"], up: 2.35, fr: 8200, tv, mf: "[]", status: "submitted", created: hAgo(1.8), sub: hAgo(1.5) }).lastInsertRowid);
    insApproval.run({ sb, req, lvl: 1, ap: personId["george"], role: "Procurement Director", min: 50000, max: 250000, amt: tv, status: "pending", esc: null, note: null, created: hAgo(1.5), decided: null });
    audit(sb, "human", personId["sofia"], "triage", "Spot buy logged", "SB-1043 — connector shortage", 4);
    audit(sb, "ai", null, "quoting", "Quote parsed", "Guangzhou Precision Parts: $64,600 landed", 2.5);
    audit(sb, "human", personId["sofia"], "quoting", "Supplier selected", "Guangzhou on best value", 2);
    audit(sb, "human", personId["sofia"], "requisition", "Requisition submitted", null, 1.5);
    audit(sb, "system", null, "approval", "Routed for DOA approval", "Procurement Director — George Mensah", 1.5);
  }

  // ============ SB-1044 — quotes in, awaiting selection (copper) ==============
  {
    const sb = spot({ title: "Copper cathode busbar stock — supplier behind", mn: "CU-CATH-GRADEA", md: "Grade-A copper cathode", qty: 40000, uom: "kg", rb: hAgo(-60), cc: "CC-4055", plant: "Voltaic Leipzig — Pack", trig: "mrp_exception", urg: "med", dt: 28000, buyer: "voltaic", buyerP: "tomas", cb: false, metal: "none", sf: "Chile", st: "Germany", inc: "DAP", status: "quoting", uc: true, createdH: 3 });
    const rfq = Number(insRfq.run(sb, "Urgent RFQ — copper cathode (SB-1044) … [AI-drafted, sent]", "sent", personId["tomas"], hAgo(2.6), hAgo(2.8)).lastInsertRowid);
    const inv1 = Number(insInvite.run(rfq, sb, orgId["andes"], personId["ricardo"], "email", "quoted", 0, hAgo(2.5), null).lastInsertRowid);
    const inv2 = Number(insInvite.run(rfq, sb, orgId["queretaro"], personId["lucia"], "email", "invited", 1, hAgo(2.5), hAgo(1)).lastInsertRowid);
    insQuote.run({ sb, inv: inv1, sup: orgId["andes"], sp: personId["ricardo"], up: 9.1, qty: 40000, lt: 12, moq: 20000, fr: 31000, fm: "expedited_ground", inc: "DAP", vu: hAgo(-96), sf: "pdf", notes: null, sel: 0, rec: hAgo(1.4) });
    audit(sb, "human", personId["tomas"], "triage", "Spot buy logged", "SB-1044 — MRP exception on copper", 3);
    audit(sb, "ai", null, "sourcing", "RFQ broadcast approved", "Sent to 2 approved suppliers", 2.6);
    audit(sb, "ai", null, "sourcing", "Follow-up sent", "Timed follow-up to Querétaro Auto Components", 1);
    audit(sb, "ai", null, "quoting", "Quote parsed", "Andes Copper SA: $395,000 landed", 1.4);
  }

  // ============ SB-1045 — RFQ drafted, not yet sent (harness) =================
  {
    const sb = spot({ title: "Wiring harness — sudden volume spike", mn: "WH-EV-MAIN", md: "EV main wiring harness", qty: 5000, uom: "ea", rb: hAgo(-96), cc: "CC-4088", plant: "Voltaic Leipzig — Assembly", trig: "volume_change", urg: "med", dt: 22000, buyer: "voltaic", buyerP: "lena", cb: false, metal: "none", status: "sourcing", uc: true, createdH: 2 });
    const rfq = Number(insRfq.run(sb, "Subject: Urgent RFQ — EV main wiring harness (SB-1045)\n\nHello,\n\nVoltaic Motors has an urgent requirement and is requesting a quote from our approved supplier base…\n\n[AI-drafted — awaiting your review and approval to send]", "draft", null, null, hAgo(1.5)).lastInsertRowid);
    insInvite.run(rfq, sb, orgId["queretaro"], personId["lucia"], "email", "invited", 0, hAgo(1.5), null);
    audit(sb, "human", personId["lena"], "triage", "Spot buy logged", "SB-1045 — volume change", 2);
    audit(sb, "human", personId["lena"], "triage", "Urgency confirmed", "Cleared to source", 1.8);
    audit(sb, "ai", null, "sourcing", "RFQ drafted", "Drafted RFQ + selected 1 approved supplier", 1.5);
  }

  // ============ SB-1046 — just logged, triage (bearings, force majeure) =======
  {
    const sb = spot({ title: "Precision bearings — supplier plant fire", mn: "BRG-6208-2RS", md: "Deep-groove ball bearings 6208-2RS", qty: 12000, uom: "ea", rb: hAgo(-40), cc: "CC-1204", plant: "Meridian Wichita — Assembly", trig: "force_majeure", urg: "critical", dt: 60000, buyer: "meridian", buyerP: "marcus", cb: false, metal: "none", status: "triage", uc: false, createdH: 0.5 });
    audit(sb, "human", personId["marcus"], "triage", "Spot buy logged", "SB-1046 — force majeure (supplier fire)", 0.5);
  }

  // ============ SB-1047 — fully worked, CLOSED, domestic (silicon) ============
  {
    const sb = spot({ title: "Silicon wafers — MRP exception", mn: "SI-WAF-200", md: "200mm silicon wafers", qty: 3000, uom: "ea", rb: hAgo(-8), cc: "CC-2288", plant: "Nimbus Fremont — Fab", trig: "mrp_exception", urg: "low", dt: 18000, buyer: "nimbus", buyerP: "wei", cb: false, metal: "none", status: "closed", uc: true, createdH: 12, closedH: 5 });
    const rfq = Number(insRfq.run(sb, "Urgent RFQ — 200mm silicon wafers (SB-1047) … [AI-drafted, sent]", "sent", personId["wei"], hAgo(11), hAgo(11.5)).lastInsertRowid);
    const inv1 = Number(insInvite.run(rfq, sb, orgId["pearlriver"], personId["lin"], "email", "quoted", 0, hAgo(11), null).lastInsertRowid);
    const qSel = Number(insQuote.run({ sb, inv: inv1, sup: orgId["pearlriver"], sp: personId["lin"], up: 42, qty: 3000, lt: 6, moq: 1000, fr: 4200, fm: "courier", inc: "DAP", vu: hAgo(-96), sf: "pdf", notes: null, sel: 1, rec: hAgo(9) }).lastInsertRowid);
    const tv = Math.round(42 * 3000 + 4200);
    const req = Number(insReq.run({ sb, qid: qSel, mn: "SI-WAF-200", md: "200mm silicon wafers", qty: 3000, uom: "ea", cc: "CC-2288", nb: hAgo(-8), sup: orgId["pearlriver"], up: 42, fr: 4200, tv, mf: "[]", status: "submitted", created: hAgo(8.5), sub: hAgo(8) }).lastInsertRowid);
    insApproval.run({ sb, req, lvl: 1, ap: personId["priya"], role: "Category Manager", min: 0, max: 50000, amt: tv, status: "approved", esc: null, note: null, created: hAgo(8), decided: hAgo(7) });
    const po = Number(insPo.run({ sb, req, po: "PO-2026-4547", sup: orgId["pearlriver"], tv, inc: "DAP", status: "released", drafted: hAgo(6.5), released: hAgo(6), rb: personId["wei"], ack: hAgo(5.5) }).lastInsertRowid);
    insPoLine.run(po, 1, "200mm silicon wafers", 3000, "ea", 42, 42 * 3000);
    insPoLine.run(po, 2, "Expedited courier", 1, "lot", 4200, 4200);
    audit(sb, "human", personId["wei"], "triage", "Spot buy logged", "SB-1047 — MRP exception", 12);
    audit(sb, "ai", null, "quoting", "Quote parsed", "Pearl River Semiconductors: $130,200 landed", 9);
    audit(sb, "human", personId["wei"], "quoting", "Supplier selected", "Pearl River on best value", 8.5);
    audit(sb, "human", personId["wei"], "requisition", "Requisition submitted", null, 8);
    audit(sb, "human", personId["priya"], "approval", "Approval granted", "Released to PO", 7);
    audit(sb, "human", personId["wei"], "po", "PO released", "PO-2026-4547 released", 6);
    audit(sb, "system", null, "closed", "Spot buy closed", "Domestic — no customs", 5);
  }
}
