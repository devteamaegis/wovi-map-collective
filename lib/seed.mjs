// Rich, realistic seed dataset for the Wovi Broker Console.
// Confidence values are NOT hand-written: raw signals (edges, outreach,
// outcomes, consents) are inserted, then recomputeAll() runs the Section-6
// math over the seeded data so every score is computed exactly as at runtime.
import { recomputeAll } from "./recompute.mjs";
import { seedReserve } from "./reserve/seed.mjs";
import { seedUsers } from "./reserve/seed-users.mjs";

// Fixed reference "now" so recency decay is deterministic across machines.
const NOW = "2026-06-29T12:00:00.000Z";
const NOW_MS = new Date(NOW).getTime();
const WEEK = 1000 * 60 * 60 * 24 * 7;

/** ISO timestamp `weeks` before NOW. */
function ago(weeks) {
  return new Date(NOW_MS - weeks * WEEK).toISOString();
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function runSeed(db) {
  const tx = db.transaction(() => {
    // ---------------------------------------------------------------- ORGS
    const orgs = [
      { ref: "meridian", name: "Meridian Aerospace", kind: "buyer", country: "United States", region: "North America", materials: ["titanium", "aluminum", "carbon composite"], capabilities: ["aerospace assembly", "airframe sourcing"], notes: "Tier-1 airframe OEM sourcing structural metals and composites." },
      { ref: "voltaic", name: "Voltaic Motors", kind: "buyer", country: "Germany", region: "Europe", materials: ["lithium", "cobalt", "nickel", "copper"], capabilities: ["EV manufacturing", "battery sourcing"], notes: "EV OEM scaling cell supply across Europe and LATAM." },
      { ref: "nimbus", name: "Nimbus Devices", kind: "buyer", country: "United States", region: "North America", materials: ["silicon", "rare earth", "copper"], capabilities: ["consumer electronics", "PCBA sourcing"], notes: "Consumer-electronics brand; semiconductor and PCBA buyer." },
      { ref: "catena", name: "Catena Apparel", kind: "buyer", country: "United States", region: "North America", materials: ["organic cotton", "polyester", "reactive dye"], capabilities: ["apparel brand", "textile sourcing"], notes: "Apparel brand sourcing certified-organic fabric." },
      { ref: "harvest", name: "Harvest & Co", kind: "buyer", country: "United Kingdom", region: "Europe", materials: ["cocoa", "coffee", "palm oil"], capabilities: ["food manufacturing", "ingredient sourcing"], notes: "Food manufacturer sourcing traceable soft commodities." },

      { ref: "sahel", name: "Sahel Lithium Works", kind: "supplier", country: "Argentina", region: "LATAM", materials: ["lithium", "lithium carbonate"], capabilities: ["brine extraction", "lithium refining"], notes: "Brine-based lithium carbonate producer in the Lithium Triangle." },
      { ref: "carpathia", name: "Carpathia Alloys", kind: "supplier", country: "Poland", region: "Europe", materials: ["titanium", "aluminum", "titanium alloy"], capabilities: ["forging", "aerospace-grade alloys"], notes: "Aerospace-grade forged titanium and aluminum alloys." },
      { ref: "pearlriver", name: "Pearl River Semiconductors", kind: "supplier", country: "China", region: "China", materials: ["silicon", "silicon wafer", "chipset"], capabilities: ["wafer fab", "foundry"], notes: "200/300mm wafer foundry; mature-node chipsets." },
      { ref: "mekong", name: "Mekong Textile Mills", kind: "supplier", country: "Vietnam", region: "SE Asia", materials: ["organic cotton", "cotton fabric", "polyester"], capabilities: ["weaving", "dyeing", "GOTS certified"], notes: "GOTS-certified woven cotton and blends." },
      { ref: "andes", name: "Andes Copper SA", kind: "supplier", country: "Chile", region: "LATAM", materials: ["copper", "copper cathode"], capabilities: ["smelting", "cathode production"], notes: "Grade-A copper cathode producer." },
      { ref: "kobalt", name: "Kobalt Nordic", kind: "supplier", country: "Finland", region: "Europe", materials: ["cobalt", "nickel"], capabilities: ["refining", "battery metals"], notes: "Conflict-free cobalt and nickel refiner." },
      { ref: "guangzhou", name: "Guangzhou Precision Parts", kind: "supplier", country: "China", region: "China", materials: ["connector", "machined part", "copper"], capabilities: ["CNC machining", "connectors"], notes: "Precision connectors and CNC components." },
      { ref: "cauca", name: "Cauca Coffee Collective", kind: "supplier", country: "Colombia", region: "LATAM", materials: ["coffee", "green coffee", "cocoa"], capabilities: ["washing", "sorting", "fair trade"], notes: "Smallholder washed-arabica and cocoa collective." },
      { ref: "selat", name: "Selat Palm Refinery", kind: "supplier", country: "Malaysia", region: "SE Asia", materials: ["palm oil", "RSPO palm oil"], capabilities: ["refining", "RSPO certified"], notes: "RSPO-certified palm oil refiner." },
      { ref: "rhine", name: "Rhine Battery Cells", kind: "supplier", country: "Germany", region: "Europe", materials: ["battery cell", "lithium", "nickel"], capabilities: ["cell assembly", "gigafactory"], notes: "European cell maker; needs upstream lithium." },
      { ref: "batam", name: "Batam Electronics Assembly", kind: "supplier", country: "Indonesia", region: "SE Asia", materials: ["PCBA", "connector", "silicon"], capabilities: ["SMT assembly", "box build"], notes: "Contract electronics assembler." },
      { ref: "queretaro", name: "Querétaro Auto Components", kind: "supplier", country: "Mexico", region: "LATAM", materials: ["wiring harness", "stamping", "copper"], capabilities: ["automotive parts", "harness assembly"], notes: "Automotive harness and stamped parts." },

      { ref: "wovi", name: "Wovi Brokerage", kind: "broker", country: "United States", region: "North America", materials: [], capabilities: ["sourcing intelligence", "relationship brokering"], notes: "Home brokerage operating this console." },
      { ref: "silkroad", name: "Silk Road Sourcing", kind: "broker", country: "Singapore", region: "SE Asia", materials: [], capabilities: ["APAC sourcing", "connector network"], notes: "APAC sourcing broker with deep China / SE Asia ties." },
      { ref: "atlas", name: "Atlas Trade Partners", kind: "broker", country: "Netherlands", region: "Europe", materials: [], capabilities: ["metals trading", "EU connector"], notes: "EU metals trading and introductions." },

      { ref: "shenzhenlab", name: "Shenzhen Test & Cert Lab", kind: "facility", country: "China", region: "China", materials: [], capabilities: ["testing", "certification"], notes: "Electronics test and certification lab." },
      { ref: "rotterdam", name: "Rotterdam Bonded Warehouse", kind: "facility", country: "Netherlands", region: "Europe", materials: [], capabilities: ["warehousing", "customs", "lane logistics"], notes: "Bonded warehouse and EU customs lane." },
      { ref: "veracruz", name: "Veracruz Cold Chain Hub", kind: "facility", country: "Mexico", region: "LATAM", materials: [], capabilities: ["cold storage", "food logistics"], notes: "Cold-chain hub for soft commodities into North America." },
    ];

    const insOrg = db.prepare(
      `INSERT INTO organizations (name,kind,country,region,materials,capabilities,notes,created_at)
       VALUES (@name,@kind,@country,@region,@materials,@capabilities,@notes,@created_at)`
    );
    const orgId = {};
    for (const o of orgs) {
      const info = insOrg.run({
        name: o.name,
        kind: o.kind,
        country: o.country,
        region: o.region,
        materials: JSON.stringify(o.materials),
        capabilities: JSON.stringify(o.capabilities),
        notes: o.notes,
        created_at: ago(60),
      });
      orgId[o.ref] = Number(info.lastInsertRowid);
    }

    // -------------------------------------------------------------- PEOPLE
    const people = [
      { ref: "dana", name: "Dana Okafor", org: "wovi", title: "Principal Broker", whatsapp: "+1 202 555 0148", phone: "+1 202 555 0148", email: "dana@wovi.io", notes: "Runs this console; deep relationships across metals and EV supply." },
      { ref: "olivia", name: "Olivia Bennett", org: "wovi", title: "Associate Broker", whatsapp: "+1 415 555 0193", email: "olivia@wovi.io", phone: "+1 415 555 0193", notes: "Covers textiles and electronics lanes." },
      { ref: "marcus", name: "Marcus Reed", org: "meridian", title: "VP Supply Chain", phone: "+1 206 555 0117", email: "m.reed@meridian-aero.com", notes: "Owns strategic metals sourcing." },
      { ref: "priya", name: "Priya Nair", org: "meridian", title: "Sr. Sourcing Manager", whatsapp: "+1 206 555 0188", email: "p.nair@meridian-aero.com", notes: "Titanium and alloy programs." },
      { ref: "lena", name: "Lena Brandt", org: "voltaic", title: "Head of Battery Procurement", whatsapp: "+49 151 5550 142", phone: "+49 151 5550 142", email: "l.brandt@voltaic.de", notes: "Lithium and cathode metals lead." },
      { ref: "tomas", name: "Tomáš Novák", org: "voltaic", title: "Raw Materials Buyer", email: "t.novak@voltaic.de", phone: "+49 151 5550 161", notes: "Copper and nickel buyer." },
      { ref: "wei", name: "Wei Zhang", org: "nimbus", title: "Director of Hardware", phone: "+1 408 555 0136", email: "wei.zhang@nimbusdevices.com", notes: "Owns component and PCBA sourcing." },
      { ref: "sofia", name: "Sofia Marenco", org: "nimbus", title: "Component Buyer", whatsapp: "+1 408 555 0174", email: "s.marenco@nimbusdevices.com", notes: "Connectors and passives." },
      { ref: "hannah", name: "Hannah Cole", org: "catena", title: "Sourcing Lead", whatsapp: "+1 503 555 0129", email: "hannah@catena.com", notes: "Certified-organic fabric programs." },
      { ref: "george", name: "George Mensah", org: "harvest", title: "Procurement Director", email: "g.mensah@harvestco.co.uk", phone: "+44 20 7946 0102", notes: "Soft-commodity sourcing and traceability." },
      { ref: "amaya", name: "Amaya Rojas", org: "sahel", title: "Commercial Director", whatsapp: "+54 9 11 5550 4471", email: "a.rojas@sahellithium.com", phone: "+54 9 11 5550 4471", notes: "Decision-maker on lithium offtake." },
      { ref: "diego", name: "Diego Fuentes", org: "sahel", title: "Export Manager", whatsapp: "+54 9 11 5550 4480", email: "d.fuentes@sahellithium.com", notes: "Handles export logistics." },
      { ref: "piotr", name: "Piotr Kowalski", org: "carpathia", title: "Sales Director", email: "p.kowalski@carpathia-alloys.pl", phone: "+48 22 555 0143", notes: "Aerospace alloy accounts." },
      { ref: "ewa", name: "Ewa Zielińska", org: "carpathia", title: "Account Manager", email: "e.zielinska@carpathia-alloys.pl", whatsapp: "+48 600 555 142", notes: "Forging program coordinator." },
      { ref: "lin", name: "Lin Mei", org: "pearlriver", title: "VP Sales", wechat: "linmei_prs", email: "lin.mei@pearlriver-semi.cn", notes: "Foundry capacity allocation." },
      { ref: "chen", name: "Chen Hao", org: "pearlriver", title: "Foundry Liaison", wechat: "chenhao_prs", phone: "+86 138 5550 7712", notes: "Technical liaison for tape-outs." },
      { ref: "binh", name: "Binh Tran", org: "mekong", title: "Mill Manager", whatsapp: "+84 90 555 0162", email: "binh.tran@mekongtextile.vn", notes: "Runs the GOTS-certified line." },
      { ref: "mai", name: "Mai Pham", org: "mekong", title: "Export Sales", whatsapp: "+84 90 555 0177", email: "mai.pham@mekongtextile.vn", notes: "International accounts." },
      { ref: "ricardo", name: "Ricardo Soto", org: "andes", title: "Sales Manager", email: "r.soto@andescopper.cl", phone: "+56 2 2555 0190", notes: "Copper cathode offtake." },
      { ref: "ines", name: "Inés Castro", org: "andes", title: "Logistics Coordinator", whatsapp: "+56 9 5555 0191", email: "i.castro@andescopper.cl", notes: "Port and lane scheduling." },
      { ref: "juhani", name: "Juhani Mäkinen", org: "kobalt", title: "Commercial Lead", email: "j.makinen@kobaltnordic.fi", phone: "+358 40 555 0123", notes: "Cobalt and nickel contracts." },
      { ref: "xiaolong", name: "Xiaolong Wu", org: "guangzhou", title: "Sales Engineer", wechat: "wuxl_gpp", email: "wu.xl@gz-precision.cn", notes: "Connector design-ins." },
      { ref: "feng", name: "Feng Li", org: "guangzhou", title: "Plant Manager", wechat: "fengli_gpp", phone: "+86 139 5550 8821", notes: "Capacity and tooling." },
      { ref: "mariana", name: "Mariana Lopez", org: "cauca", title: "Co-op Director", whatsapp: "+57 320 555 0144", email: "mariana@caucacoffee.co", notes: "Fair-trade certification and offtake." },
      { ref: "azlan", name: "Azlan Ibrahim", org: "selat", title: "Commercial Manager", whatsapp: "+60 12 555 0166", email: "azlan@selatpalm.my", notes: "RSPO offtake contracts." },
      { ref: "stefan", name: "Stefan Vogel", org: "rhine", title: "Procurement Manager", email: "s.vogel@rhinecells.de", phone: "+49 151 5550 199", whatsapp: "+49 151 5550 199", notes: "Sources upstream lithium for cells." },
      { ref: "arif", name: "Arif Santoso", org: "batam", title: "Operations Director", whatsapp: "+62 811 555 0152", email: "arif@batamassembly.id", notes: "SMT line capacity." },
      { ref: "lucia", name: "Lucía Herrera", org: "queretaro", title: "Sales Director", email: "l.herrera@queretaroauto.mx", whatsapp: "+52 442 555 0188", phone: "+52 442 555 0188", notes: "Harness and stamping accounts." },
      { ref: "sergio", name: "Sergio Vargas", org: "queretaro", title: "Quality Manager", email: "s.vargas@queretaroauto.mx", phone: "+52 442 555 0190", notes: "PPAP and quality." },
      { ref: "raj", name: "Raj Malhotra", org: "silkroad", title: "Managing Partner", whatsapp: "+65 8555 0142", wechat: "rajm_silkroad", email: "raj@silkroadsourcing.sg", notes: "Top connector into LATAM lithium and China parts." },
      { ref: "grace", name: "Grace Tan", org: "silkroad", title: "Sourcing Associate", whatsapp: "+65 8555 0177", email: "grace@silkroadsourcing.sg", notes: "China connectors and electronics." },
      { ref: "kenji", name: "Kenji Watanabe", org: "silkroad", title: "Japan Desk", whatsapp: "+65 8555 0181", email: "kenji@silkroadsourcing.sg", notes: "SE Asia palm and food lanes." },
      { ref: "willem", name: "Willem de Vries", org: "atlas", title: "Partner", email: "willem@atlastrade.nl", phone: "+31 6 5555 0142", whatsapp: "+31 6 5555 0142", notes: "EU metals connector; copper and titanium." },
      { ref: "anke", name: "Anke Bakker", org: "atlas", title: "Trade Analyst", email: "anke@atlastrade.nl", notes: "Market and counterparty research." },
      { ref: "fatima", name: "Fatima Khan", org: "atlas", title: "Logistics Lead", email: "fatima@atlastrade.nl", whatsapp: "+31 6 5555 0160", notes: "Lane design and customs." },
      { ref: "jun", name: "Jun Park", org: "shenzhenlab", title: "Lab Director", wechat: "junpark_lab", email: "jun@shenzhen-testcert.cn", notes: "Compliance and certification." },
      { ref: "emma", name: "Emma Schulz", org: "rotterdam", title: "Operations Manager", email: "e.schulz@rotterdam-bonded.nl", phone: "+31 10 555 0173", notes: "Bonded warehouse and EU customs." },
      { ref: "carlos", name: "Carlos Mendes", org: "veracruz", title: "Hub Manager", whatsapp: "+52 229 555 0145", email: "c.mendes@veracruzcold.mx", phone: "+52 229 555 0145", notes: "Cold-chain into North America." },
    ];

    const insPerson = db.prepare(
      `INSERT INTO people (name,org_id,title,whatsapp,wechat,phone,email,notes,created_at)
       VALUES (@name,@org_id,@title,@whatsapp,@wechat,@phone,@email,@notes,@created_at)`
    );
    const personId = {};
    for (const p of people) {
      const info = insPerson.run({
        name: p.name,
        org_id: orgId[p.org] ?? null,
        title: p.title ?? null,
        whatsapp: p.whatsapp ?? null,
        wechat: p.wechat ?? null,
        phone: p.phone ?? null,
        email: p.email ?? null,
        notes: p.notes ?? null,
        created_at: ago(55),
      });
      personId[p.ref] = Number(info.lastInsertRowid);
    }

    // Resolve a ref to a {type,id} graph node (person refs take precedence).
    function ref(r) {
      if (personId[r] != null) return { type: "person", id: personId[r] };
      if (orgId[r] != null) return { type: "org", id: orgId[r] };
      throw new Error("Unknown ref: " + r);
    }

    // --------------------------------------------------------------- NEEDS
    const needs = [
      { ref: "n_lithium", title: "Battery-grade lithium carbonate supplier for EU cell line", kind: "supplier", description: "Voltaic needs 5,000 t/yr of battery-grade Li2CO3 with a traceable, conflict-aware origin to feed its new German cell line. Prefers LATAM brine.", material_tag: "lithium", target_region: "LATAM", requester: "voltaic", requester_person: "lena", status: "matched", priority: "high", created_at: ago(7), closed_at: null },
      { ref: "n_titanium", title: "Aerospace-grade titanium alloy, AMS-spec", kind: "material", description: "Meridian is qualifying a second source of AMS 4928 titanium bar for airframe structures. EU forging preferred for lead-time.", material_tag: "titanium", target_region: "Europe", requester: "meridian", requester_person: "priya", status: "brokering", priority: "high", created_at: ago(5), closed_at: null },
      { ref: "n_pcba", title: "SMT assembly facility for mid-volume PCBA", kind: "facility", description: "Nimbus needs a vetted SMT/box-build facility in SE Asia for 50k units/mo, with in-region test and cert.", material_tag: "PCBA", target_region: "SE Asia", requester: "nimbus", requester_person: "wei", status: "open", priority: "med", created_at: ago(2), closed_at: null },
      { ref: "n_connector", title: "High-current board-to-board connectors", kind: "part", description: "Nimbus needs a 2nd source for 40A board-to-board connectors, China-based, design-in support required.", material_tag: "connector", target_region: "China", requester: "nimbus", requester_person: "sofia", status: "matched", priority: "med", created_at: ago(9), closed_at: null },
      { ref: "n_cocoa", title: "Cold-chain lane for traceable cocoa into UK", kind: "lane", description: "Harvest needed a temperature-controlled lane for single-origin cocoa from LATAM into the UK with bonded EU transit.", material_tag: "cocoa", target_region: "LATAM", requester: "harvest", requester_person: "george", status: "closed", priority: "low", created_at: ago(16), closed_at: ago(3) },
      { ref: "n_cotton", title: "GOTS-certified organic cotton fabric", kind: "supplier", description: "Catena is sourcing GOTS-certified woven organic cotton from SE Asia for a new sustainable line.", material_tag: "organic cotton", target_region: "SE Asia", requester: "catena", requester_person: "hannah", status: "brokering", priority: "med", created_at: ago(6), closed_at: null },
      { ref: "n_copper", title: "Grade-A copper cathode, long-term", kind: "material", description: "Voltaic needs a long-term Grade-A copper cathode contract from LATAM for busbars and windings.", material_tag: "copper", target_region: "LATAM", requester: "voltaic", requester_person: "tomas", status: "matched", priority: "high", created_at: ago(8), closed_at: null },
    ];

    const insNeed = db.prepare(
      `INSERT INTO needs (title,kind,description,material_tag,target_region,requester_org_id,requester_person_id,status,priority,created_at,closed_at)
       VALUES (@title,@kind,@description,@material_tag,@target_region,@requester_org_id,@requester_person_id,@status,@priority,@created_at,@closed_at)`
    );
    const needId = {};
    for (const n of needs) {
      const info = insNeed.run({
        title: n.title,
        kind: n.kind,
        description: n.description,
        material_tag: n.material_tag,
        target_region: n.target_region,
        requester_org_id: orgId[n.requester] ?? null,
        requester_person_id: personId[n.requester_person] ?? null,
        status: n.status,
        priority: n.priority,
        created_at: n.created_at,
        closed_at: n.closed_at,
      });
      needId[n.ref] = Number(info.lastInsertRowid);
    }

    // --------------------------------------------------------------- EDGES
    // [srcRef, tgtRef, kind, consent, firstSeenWeeks, lastConfirmedWeeks|null, provenance, evidence]
    const edgeDefs = [
      ["e1", "lena", "dana", "knows", "double_opt_in", 30, 2, "Repeated dealings 2024–2026", "Lena trusts Dana for EV metals intros."],
      ["e2", "lena", "raj", "knows", "one_sided", 24, 6, "Met at Battery Show 2025", "Lena knows Raj; warm but newer."],
      ["e3", "priya", "dana", "knows", "double_opt_in", 40, 5, "Long-standing titanium work", "Priya and Dana have closed multiple alloy deals."],
      ["e4", "marcus", "willem", "knows", "one_sided", 20, 10, "Intro via trade show", "Marcus knows Willem on metals."],
      ["e5", "wei", "dana", "knows", "double_opt_in", 18, 3, "Electronics sourcing 2025", "Wei relies on Dana for component intros."],
      ["e6", "sofia", "grace", "knows", "one_sided", 16, 4, "Referred by Wei", "Sofia knows Grace for China connectors."],
      ["e7", "hannah", "olivia", "knows", "double_opt_in", 22, 7, "Textile program 2025", "Hannah and Olivia worked an organic line."],
      ["e8", "george", "dana", "knows", "none", 50, 30, "Cold contact 2024", "Old contact, not recently confirmed."],
      ["e9", "tomas", "willem", "knows", "one_sided", 14, 3, "Copper RFQ 2026", "Tomáš knows Willem for copper."],
      ["e10", "lena", "willem", "knows", "none", 12, null, "Conference badge scan", "Weak, unconfirmed acquaintance."],
      ["e11", "stefan", "raj", "knows", "one_sided", 26, 8, "Lithium upstream talks", "Stefan knows Raj; later declined a deal."],
      ["e12", "hannah", "grace", "knows", "none", 10, null, "LinkedIn intro", "Unconfirmed."],

      ["e13", "raj", "sahel", "sources_from", "double_opt_in", 36, 4, "Raj has sourced Li from Sahel before", "Confirmed offtake relationship."],
      ["e14", "dana", "carpathia", "knows", "one_sided", 28, 9, "Alloy sourcing 2025", "Dana knows Carpathia commercial team."],
      ["e15", "willem", "carpathia", "sources_from", "double_opt_in", 44, 6, "Willem trades Carpathia titanium", "Established trading relationship."],
      ["e16", "grace", "guangzhou", "sources_from", "double_opt_in", 30, 3, "Grace sources connectors from GPP", "Repeated parts sourcing."],
      ["e17", "raj", "pearlriver", "knows", "one_sided", 20, 5, "Foundry intro 2025", "Raj knows Pearl River sales."],
      ["e18", "willem", "andes", "sources_from", "double_opt_in", 38, 2, "Willem trades Andes cathode", "Active copper relationship."],
      ["e19", "olivia", "mekong", "knows", "one_sided", 18, 6, "Mill visit 2025", "Olivia knows the Mekong mill team."],
      ["e20", "grace", "batam", "sources_from", "one_sided", 22, 7, "PCBA sourcing 2025", "Grace has placed PCBA with Batam."],
      ["e21", "dana", "cauca", "knows", "none", 40, 26, "Coffee/cocoa contact", "Aging relationship."],
      ["e22", "kenji", "selat", "sources_from", "none", 16, 12, "Palm oil inquiry", "Explored, later refused terms."],
      ["e23", "willem", "kobalt", "sources_from", "one_sided", 24, 8, "Battery metals trading", "Willem trades Kobalt cobalt."],
      ["e24", "raj", "guangzhou", "knows", "none", 14, null, "Secondary contact", "Knows GPP but not primary."],
      ["e25", "olivia", "queretaro", "knows", "one_sided", 20, 5, "Automotive lane 2025", "Olivia knows Querétaro sales."],
      ["e26", "anke", "carpathia", "knows", "none", 12, null, "Research contact", "Analyst-level contact."],
      ["e27", "fatima", "rotterdam", "knows", "double_opt_in", 30, 4, "Lane partner", "Fatima works lanes through Rotterdam."],
      ["e28", "dana", "veracruz", "knows", "one_sided", 26, 9, "Cold-chain contact", "Dana knows the Veracruz hub."],

      ["e29", "sahel", "voltaic", "brokered_intro", "double_opt_in", 4, 1, "Brokered by Dana via Raj", "Double opt-in lithium intro — the worked result."],
      ["e30", "guangzhou", "nimbus", "brokered_intro", "double_opt_in", 3, 1, "Brokered by Grace", "Double opt-in connector intro."],
      ["e31", "andes", "voltaic", "brokered_intro", "double_opt_in", 5, 1, "Brokered by Willem", "Double opt-in copper intro."],
      ["e32", "carpathia", "meridian", "supplies", "double_opt_in", 60, 8, "Established supply", "Carpathia supplies Meridian aluminum today."],
      ["e33", "pearlriver", "nimbus", "supplies", "double_opt_in", 70, 10, "Established supply", "Pearl River supplies Nimbus wafers."],
      ["e34", "mekong", "catena", "sources_from", "one_sided", 30, 12, "Prior fabric order", "Catena has bought Mekong fabric once."],
      ["e35", "kobalt", "voltaic", "supplies", "double_opt_in", 50, 6, "Cobalt contract", "Kobalt supplies Voltaic cobalt."],
      ["e36", "rhine", "voltaic", "supplies", "one_sided", 40, 14, "Cell supply talks", "Rhine supplies some cells to Voltaic."],
      ["e37", "queretaro", "voltaic", "supplies", "none", 20, 18, "Harness inquiry", "Early-stage, unconfirmed."],
      ["e38", "selat", "harvest", "supplies", "none", 24, 20, "Palm oil inquiry", "Stalled."],
      ["e39", "cauca", "harvest", "brokered_intro", "double_opt_in", 30, 9, "Brokered cocoa intro", "Resulted in the closed cocoa lane."],
      ["e40", "batam", "nimbus", "supplies", "one_sided", 28, 10, "PCBA trial", "Batam ran a PCBA trial for Nimbus."],

      ["e41", "sahel", "rhine", "supplies", "one_sided", 22, 7, "Lithium to cell maker", "Sahel supplies Rhine some lithium."],
      ["e42", "andes", "queretaro", "supplies", "none", 18, 16, "Copper to harness", "Andes copper into Querétaro."],
      ["e43", "rotterdam", "harvest", "knows", "double_opt_in", 26, 5, "Lane partner", "Rotterdam handles Harvest EU transit."],
      ["e44", "veracruz", "harvest", "knows", "one_sided", 20, 8, "Cold-chain partner", "Veracruz cold-chain for Harvest."],
      ["e45", "shenzhenlab", "nimbus", "knows", "one_sided", 16, 6, "Testing partner", "Shenzhen lab tests Nimbus units."],
      ["e46", "shenzhenlab", "batam", "knows", "none", 14, null, "Co-located testing", "Lab near Batam assembler."],
      ["e47", "pearlriver", "batam", "supplies", "one_sided", 30, 11, "Wafers to assembler", "Pearl River supplies Batam."],
      ["e48", "guangzhou", "batam", "supplies", "none", 18, 13, "Connectors to assembler", "GPP supplies Batam connectors."],

      ["e49", "raj", "amaya", "introduced_by", "double_opt_in", 36, 4, "Raj introduced Amaya", "Personal trusted intro at Sahel."],
      ["e50", "grace", "xiaolong", "introduced_by", "double_opt_in", 30, 3, "Grace introduced Xiaolong", "Personal trusted intro at GPP."],
      ["e51", "willem", "ricardo", "introduced_by", "double_opt_in", 38, 2, "Willem introduced Ricardo", "Personal trusted intro at Andes."],
      ["e52", "willem", "piotr", "introduced_by", "one_sided", 44, 6, "Willem knows Piotr", "Intro at Carpathia, one-sided so far."],
      ["e53", "olivia", "binh", "knows", "one_sided", 18, 6, "Mill manager contact", "Olivia knows Binh at Mekong."],
      ["e54", "grace", "arif", "knows", "one_sided", 22, 7, "Assembly contact", "Grace knows Arif at Batam."],
      ["e55", "dana", "mariana", "knows", "none", 40, 26, "Co-op contact", "Aging cocoa contact."],
      ["e56", "raj", "lin", "knows", "one_sided", 20, 5, "Foundry sales contact", "Raj knows Lin at Pearl River."],
      ["e57", "kenji", "azlan", "knows", "none", 16, 12, "Palm oil contact", "Kenji knows Azlan at Selat."],
      ["e58", "fatima", "emma", "knows", "double_opt_in", 30, 4, "Lane operations contact", "Fatima and Emma run the Rotterdam lane."],
    ];

    const insEdge = db.prepare(
      `INSERT INTO edges (source_type,source_id,target_type,target_id,kind,confidence,consent_status,provenance,evidence_note,first_seen_at,last_confirmed_at)
       VALUES (@source_type,@source_id,@target_type,@target_id,@kind,0,@consent_status,@provenance,@evidence_note,@first_seen_at,@last_confirmed_at)`
    );
    const edgeId = {};
    for (const e of edgeDefs) {
      const [eref, s, t, kind, consent, fs, lc, prov, ev] = e;
      const src = ref(s);
      const tgt = ref(t);
      const info = insEdge.run({
        source_type: src.type,
        source_id: src.id,
        target_type: tgt.type,
        target_id: tgt.id,
        kind,
        consent_status: consent,
        provenance: prov,
        evidence_note: ev,
        first_seen_at: ago(fs),
        last_confirmed_at: lc == null ? null : ago(lc),
      });
      edgeId[eref] = Number(info.lastInsertRowid);
    }

    // --------------------------------------------------------------- PATHS
    // [pathRef, needRef, targetOrgRef, connectorPersonRef, status, rationale, [hopRefs]]
    const pathDefs = [
      ["p_lithium", "n_lithium", "sahel", "raj", "consented", "Lena → Raj (trusted LATAM connector) → Sahel Lithium. Raj has a confirmed offtake relationship with Sahel.", ["lena", "raj", "sahel"]],
      ["p_titanium", "n_titanium", "carpathia", "dana", "awaiting_consent", "Priya → Dana → Carpathia Alloys. Dana knows the Carpathia commercial team; waiting on supplier consent.", ["priya", "dana", "carpathia"]],
      ["p_connector", "n_connector", "guangzhou", "grace", "consented", "Sofia → Grace (Silk Road) → Guangzhou Precision. Grace sources connectors from GPP regularly.", ["sofia", "grace", "guangzhou"]],
      ["p_cotton", "n_cotton", "mekong", "olivia", "outreach", "Hannah → Olivia → Mekong Textile Mills. Olivia knows the GOTS-certified mill; outreach in progress.", ["hannah", "olivia", "mekong"]],
      ["p_copper", "n_copper", "andes", "willem", "consented", "Tomáš → Willem (Atlas) → Andes Copper. Willem actively trades Andes Grade-A cathode.", ["tomas", "willem", "andes"]],
      ["p_cocoa", "n_cocoa", "cauca", "dana", "consented", "George → Dana → Cauca Collective, with a Rotterdam bonded lane. Closed and sourced.", ["george", "dana", "cauca"]],
    ];

    const insPath = db.prepare(
      `INSERT INTO paths (need_id,target_org_id,connector_person_id,rationale,status,confidence,created_at,updated_at)
       VALUES (@need_id,@target_org_id,@connector_person_id,@rationale,@status,0,@created_at,@updated_at)`
    );
    const insHop = db.prepare(
      `INSERT INTO path_hops (path_id,position,node_type,node_id) VALUES (?,?,?,?)`
    );
    const pathId = {};
    for (const p of pathDefs) {
      const [pref, nref, targetOrg, connector, status, rationale, hops] = p;
      const info = insPath.run({
        need_id: needId[nref],
        target_org_id: orgId[targetOrg] ?? null,
        connector_person_id: personId[connector] ?? null,
        rationale,
        status,
        created_at: ago(6),
        updated_at: ago(1),
      });
      const pid = Number(info.lastInsertRowid);
      pathId[pref] = pid;
      hops.forEach((h, i) => {
        const node = ref(h);
        insHop.run(pid, i, node.type, node.id);
      });
    }

    // ------------------------------------------------------------ OUTREACH
    // [pathRef|null, edgeRef|null, channel, direction, personRef, summary, outcome, weeksAgo]
    const outreachDefs = [
      ["p_lithium", "e2", "whatsapp", "out", "raj", "Asked Raj if he could open a door to Sahel for battery-grade Li2CO3.", "interested", 6],
      ["p_lithium", "e13", "email", "out", "amaya", "Emailed Amaya at Sahel outlining Voltaic's 5kt/yr requirement and origin traceability.", "interested", 4],
      ["p_lithium", "e29", "whatsapp", "in", "amaya", "Amaya confirmed Sahel consents to a direct intro to Voltaic.", "consented", 2],
      ["p_connector", "e6", "whatsapp", "out", "grace", "Asked Grace to source a 2nd connector supplier in China for Nimbus.", "interested", 8],
      ["p_connector", "e16", "wechat", "out", "xiaolong", "WeChat to Xiaolong at GPP about 40A board-to-board connectors and design-in support.", "interested", 6],
      ["p_connector", "e30", "wechat", "in", "xiaolong", "Xiaolong confirmed GPP is happy to be introduced to Nimbus.", "consented", 3],
      ["p_copper", "e9", "email", "out", "willem", "Asked Willem to bring Andes Grade-A cathode to Voltaic on a long-term basis.", "interested", 7],
      ["p_copper", "e18", "whatsapp", "out", "ricardo", "WhatsApp to Ricardo at Andes about long-term copper offtake for Voltaic.", "interested", 5],
      ["p_copper", "e31", "phone", "in", "ricardo", "Ricardo confirmed Andes consents to the Voltaic introduction.", "consented", 2],
      ["p_titanium", "e14", "email", "out", "piotr", "Emailed Piotr at Carpathia about a 2nd-source AMS 4928 titanium program.", "no_reply", 4],
      ["p_titanium", "e14", "phone", "out", "piotr", "Called Piotr; he's interested but needs internal sign-off before consenting.", "interested", 2],
      ["p_cotton", "e19", "whatsapp", "out", "binh", "Asked Binh whether Mekong's GOTS line has capacity for Catena's new line.", "interested", 5],
      ["p_cotton", "e19", "email", "in", "binh", "Binh replied correcting the certification scope — GOTS yes, OCS pending.", "corrected", 3],
      [null, "e20", "whatsapp", "out", "arif", "Reached out to Arif at Batam about SMT capacity for a possible Nimbus facility need.", "no_reply", 2],
      ["p_cocoa", "e21", "phone", "out", "mariana", "Called Mariana about single-origin cocoa for Harvest's UK line.", "interested", 12],
      ["p_cocoa", "e39", "email", "in", "mariana", "Mariana confirmed the co-op consents to supply Harvest.", "consented", 9],
      ["p_cocoa", "e58", "in_person", "out", "emma", "Met Emma at Rotterdam to design the bonded cold-chain transit.", "interested", 10],
      [null, "e17", "wechat", "out", "lin", "Pinged Lin at Pearl River about spare foundry capacity.", "no_reply", 5],
      [null, "e35", "email", "out", "juhani", "Confirmed Kobalt cobalt volumes for Voltaic's next contract year.", "interested", 6],
      [null, "e11", "whatsapp", "out", "stefan", "Floated a lithium upstream deal to Stefan at Rhine.", "refused", 8],
      [null, "e22", "phone", "out", "azlan", "Discussed RSPO palm oil terms with Azlan at Selat.", "refused", 12],
      [null, "e26", "email", "out", "ewa", "Asked Ewa at Carpathia for current forging lead-times.", "interested", 9],
      [null, "e34", "whatsapp", "in", "mai", "Mai followed up on a possible repeat fabric order for Catena.", "interested", 12],
      [null, "e15", "in_person", "out", "willem", "Met Willem at the metals expo; confirmed Carpathia titanium availability.", "interested", 6],
      [null, "e17", "wechat", "out", "chen", "Technical question to Chen about tape-out timelines.", "no_reply", 5],
    ];

    const insOutreach = db.prepare(
      `INSERT INTO outreach (path_id,edge_id,channel,direction,person_id,summary,outcome,occurred_at)
       VALUES (@path_id,@edge_id,@channel,@direction,@person_id,@summary,@outcome,@occurred_at)`
    );
    for (const o of outreachDefs) {
      const [pref, eref, channel, direction, person, summary, outcome, weeks] = o;
      insOutreach.run({
        path_id: pref ? pathId[pref] : null,
        edge_id: eref ? edgeId[eref] : null,
        channel,
        direction,
        person_id: person ? personId[person] : null,
        summary,
        outcome,
        occurred_at: ago(weeks),
      });
    }

    // ------------------------------------------------------------- CONSENTS
    // [pathRef|null, edgeRef|null, personRef, side, status, note, createdWeeks, decidedWeeks|null]
    const consentDefs = [
      ["p_lithium", "e29", "lena", "requester", "granted", "Voltaic consents to an intro to Sahel.", 4, 2],
      ["p_lithium", "e29", "amaya", "supplier", "granted", "Sahel consents to an intro to Voltaic.", 4, 2],
      ["p_connector", "e30", "sofia", "requester", "granted", "Nimbus consents to an intro to GPP.", 5, 3],
      ["p_connector", "e30", "xiaolong", "supplier", "granted", "GPP consents to an intro to Nimbus.", 5, 3],
      ["p_copper", "e31", "tomas", "requester", "granted", "Voltaic consents to an intro to Andes.", 4, 2],
      ["p_copper", "e31", "ricardo", "supplier", "granted", "Andes consents to an intro to Voltaic.", 4, 2],
      ["p_titanium", null, "priya", "requester", "granted", "Meridian consents to an intro to Carpathia.", 3, 2],
      ["p_titanium", null, "piotr", "supplier", "pending", "Awaiting Carpathia internal sign-off.", 2, null],
      ["p_cotton", null, "hannah", "requester", "granted", "Catena consents to an intro to Mekong.", 4, 3],
      ["p_cotton", null, "binh", "supplier", "pending", "Mekong reviewing certification scope before consenting.", 3, null],
      ["p_cocoa", "e39", "george", "requester", "granted", "Harvest consents to an intro to Cauca.", 11, 10],
      ["p_cocoa", "e39", "mariana", "supplier", "granted", "Cauca consents to supply Harvest.", 11, 9],
      [null, "e35", "lena", "requester", "granted", "Historical: Voltaic consented to Kobalt cobalt deal.", 50, 49],
      [null, "e35", "juhani", "supplier", "granted", "Historical: Kobalt consented to supply Voltaic.", 50, 49],
      [null, "e22", "azlan", "supplier", "refused", "Selat declined the proposed RSPO terms.", 13, 12],
      [null, "e11", "stefan", "supplier", "revoked", "Rhine revoked earlier interest in the upstream lithium deal.", 9, 8],
      [null, "e20", "wei", "requester", "pending", "Nimbus exploring a possible SMT facility consent.", 2, null],
      [null, "e20", "arif", "supplier", "pending", "Batam awaiting details before consenting.", 2, null],
    ];

    const insConsent = db.prepare(
      `INSERT INTO consents (path_id,edge_id,person_id,side,status,note,created_at,decided_at)
       VALUES (@path_id,@edge_id,@person_id,@side,@status,@note,@created_at,@decided_at)`
    );
    for (const c of consentDefs) {
      const [pref, eref, person, side, status, note, cw, dw] = c;
      insConsent.run({
        path_id: pref ? pathId[pref] : null,
        edge_id: eref ? edgeId[eref] : null,
        person_id: personId[person],
        side,
        status,
        note,
        created_at: ago(cw),
        decided_at: dw == null ? null : ago(dw),
      });
    }

    // ------------------------------------------------------------- OUTCOMES
    // [pathRef|null, edgeRef|null, result, note, weeksAgo]
    const outcomeDefs = [
      ["p_lithium", "e29", "consented_intro", "Double opt-in intro made: Voltaic ↔ Sahel for lithium carbonate.", 2],
      ["p_connector", "e30", "consented_intro", "Double opt-in intro made: Nimbus ↔ GPP for connectors.", 3],
      ["p_copper", "e31", "consented_intro", "Double opt-in intro made: Voltaic ↔ Andes for copper cathode.", 2],
      ["p_cocoa", "e39", "sourced", "Cocoa sourced and the cold-chain lane went live; need closed.", 3],
      [null, "e13", "sourced", "Raj's Sahel relationship confirmed by a live lithium offtake.", 4],
      [null, "e32", "sourced", "Carpathia → Meridian aluminum supply confirmed this quarter.", 8],
      [null, "e33", "sourced", "Pearl River → Nimbus wafer supply confirmed.", 10],
      [null, "e35", "consented_intro", "Kobalt → Voltaic cobalt contract confirmed.", 6],
      [null, "e22", "dead_end", "Selat palm oil terms fell through.", 12],
      [null, "e11", "declined", "Rhine declined the upstream lithium deal.", 8],
      [null, "e34", "corrected", "Mekong corrected the certification scope on file.", 12],
      [null, "e16", "sourced", "Grace's GPP connector relationship confirmed by a live order.", 3],
    ];

    const insOutcome = db.prepare(
      `INSERT INTO outcomes (path_id,edge_id,result,confidence_delta,note,created_at)
       VALUES (@path_id,@edge_id,@result,0,@note,@created_at)`
    );
    for (const o of outcomeDefs) {
      const [pref, eref, result, note, weeks] = o;
      insOutcome.run({
        path_id: pref ? pathId[pref] : null,
        edge_id: eref ? edgeId[eref] : null,
        result,
        note,
        created_at: ago(weeks),
      });
    }

    // Compute every edge + path confidence from the seeded signals (Section 6).
    recomputeAll(db, NOW);

    // Reserve — spot-buy scenarios (runs after recompute so its supply edges keep
    // their explicit confidence). Reuses the org/person ref maps built above.
    // Seeded relative to the REAL clock (not the frozen NOW) so the live downtime
    // clocks and audit timestamps read as an hours-scale, in-progress process.
    seedReserve(db, { orgId, personId, NOW: new Date().toISOString() });

    // Demo login accounts (buyer + approvers) so auth + SoD are usable in the demo.
    seedUsers(db, { personId, NOW: new Date().toISOString() });
  });

  tx();
}
