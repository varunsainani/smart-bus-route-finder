// Generic CRUD for the core entities. Each resource exposes:
//   GET /        list (supports ?limit & ?offset)
//   GET /:id     read one
//   POST /       create
//   PUT /:id     update
//   DELETE /:id  delete
const express = require("express");
const db = require("../db");

// resource -> table, primary key, writable columns
const RESOURCES = {
  routes:     { table: "route",     pk: "route_id",     cols: ["code", "name", "route_type_id", "operator_id", "length_km", "is_active", "launch_date"] },
  stops:      { table: "stop",      pk: "stop_id",      cols: ["name", "zone_id", "latitude", "longitude", "is_terminal", "has_shelter"] },
  passengers: { table: "passenger", pk: "passenger_id", cols: ["full_name", "email", "phone", "home_zone_id", "signup_date", "gender"] },
  drivers:    { table: "driver",    pk: "driver_id",    cols: ["full_name", "license_no", "operator_id", "phone", "hire_date", "shift"] },
  operators:  { table: "operator",  pk: "operator_id",  cols: ["name", "short_name", "operator_type", "contact_phone", "established_year"] },
  buses:      { table: "bus",       pk: "bus_id",       cols: ["registration_no", "bus_model_id", "operator_id", "route_id", "status", "in_service_date", "odometer_km"] },
  feedback:   { table: "feedback",  pk: "feedback_id",  cols: ["passenger_id", "route_id", "journey_id", "rating", "category", "comment"] },
  incidents:  { table: "incident",  pk: "incident_id",  cols: ["route_id", "stop_id", "incident_type", "severity", "reported_at", "resolved_at", "description"] },
};

function buildRouter(cfg) {
  const r = express.Router();
  const { table, pk, cols } = cfg;

  // list
  r.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
      const offset = parseInt(req.query.offset, 10) || 0;
      const { rows } = await db.query(
        `SELECT * FROM ${table} ORDER BY ${pk} LIMIT $1 OFFSET $2`, [limit, offset]);
      const total = (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
      res.json({ total, count: rows.length, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // read one
  r.get("/:id", async (req, res) => {
    try {
      const { rows } = await db.query(`SELECT * FROM ${table} WHERE ${pk} = $1`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // create
  r.post("/", async (req, res) => {
    try {
      const keys = cols.filter((c) => req.body[c] !== undefined);
      if (!keys.length) return res.status(400).json({ error: "No valid fields provided" });
      const vals = keys.map((k) => req.body[k]);
      const ph = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await db.query(
        `INSERT INTO ${table} (${keys.join(",")}) VALUES (${ph.join(",")}) RETURNING *`, vals);
      res.status(201).json(rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // update
  r.put("/:id", async (req, res) => {
    try {
      const keys = cols.filter((c) => req.body[c] !== undefined);
      if (!keys.length) return res.status(400).json({ error: "No valid fields provided" });
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const vals = keys.map((k) => req.body[k]);
      vals.push(req.params.id);
      const { rows } = await db.query(
        `UPDATE ${table} SET ${sets.join(",")} WHERE ${pk} = $${vals.length} RETURNING *`, vals);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // delete
  r.delete("/:id", async (req, res) => {
    try {
      const { rowCount } = await db.query(`DELETE FROM ${table} WHERE ${pk} = $1`, [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Not found" });
      res.json({ deleted: true, id: Number(req.params.id) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  return r;
}

function mountAll(app) {
  for (const [name, cfg] of Object.entries(RESOURCES)) {
    app.use(`/api/${name}`, buildRouter(cfg));
  }
}

module.exports = { mountAll, RESOURCES };
