// Demo login accounts (#1). Created only by `npm run seed:demo` so the demo is
// usable behind auth and segregation-of-duties is demonstrable (a buyer submits;
// an approver signs off). All demo passwords are "reserve12". The admin has no
// linked person, so it can drive the whole pipeline without an SoD block.
import crypto from "node:crypto";

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function seedUsers(db, ctx) {
  const { personId, NOW } = ctx;
  if ((db.prepare("SELECT COUNT(*) c FROM users").get().c) > 0) return;
  const pw = hashPassword("reserve12");
  const ins = db.prepare(
    "INSERT INTO users (name,email,password_hash,role,person_id,active,created_at) VALUES (?,?,?,?,?,1,?)"
  );
  const rows = [
    ["Admin", "admin@wovi.io", "admin", null],
    ["Priya Nair", "p.nair@meridian-aero.com", "buyer", personId["priya"] ?? null],
    ["George Mensah", "g.mensah@harvestco.co.uk", "approver", personId["george"] ?? null],
    ["Marcus Reed", "m.reed@meridian-aero.com", "approver", personId["marcus"] ?? null],
    ["Evelyn Cho", "evelyn@wovi.io", "approver", personId["evelyn"] ?? null],
  ];
  for (const [name, email, role, pid] of rows) {
    ins.run(name, email, pw, role, pid, NOW);
  }
}
