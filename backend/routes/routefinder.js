// Route finder: Dijkstra shortest path across the bus-stop graph.
// Nodes are (route, stop) states; riding moves along a route, transfers switch
// routes at a shared stop. Optimises total travel time, then computes the fare
// per leg from the fare_stage table.
const express = require("express");
const db = require("../db");
const router = express.Router();

const TRANSFER_MIN = 5; // time penalty for changing buses

// ---- list stops (for the search autocomplete) -----------------------------
router.get("/stops", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.stop_id, s.name, s.latitude, s.longitude, z.name AS zone,
              s.is_terminal,
              array_agg(DISTINCT r.code ORDER BY r.code) AS routes
       FROM stop s
       LEFT JOIN zone z ON z.zone_id = s.zone_id
       LEFT JOIN route_stop rs ON rs.stop_id = s.stop_id
       LEFT JOIN route r ON r.route_id = rs.route_id
       GROUP BY s.stop_id, z.name
       ORDER BY s.name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- build the in-memory graph from the database --------------------------
async function loadGraph() {
  const { rows } = await db.query(
    `SELECT rs.route_id, r.code, r.name AS route_name, rt.name AS type, rt.color_hex,
            rs.stop_id, rs.stop_sequence, rs.distance_from_prev_km,
            rs.time_from_prev_min, s.name AS stop_name, s.latitude, s.longitude
     FROM route_stop rs
     JOIN route r ON r.route_id = rs.route_id
     JOIN route_type rt ON rt.route_type_id = r.route_type_id
     JOIN stop s ON s.stop_id = rs.stop_id
     ORDER BY rs.route_id, rs.stop_sequence`
  );
  const fareStages = (await db.query(
    `SELECT rt.name AS type, fs.max_distance_km, fs.fare
     FROM fare_stage fs JOIN route_type rt ON rt.route_type_id = fs.route_type_id
     ORDER BY rt.name, fs.max_distance_km`
  )).rows;

  const stagesByType = {};
  for (const s of fareStages) {
    (stagesByType[s.type] = stagesByType[s.type] || []).push([Number(s.max_distance_km), Number(s.fare)]);
  }
  const fareFor = (type, dist) => {
    const stages = stagesByType[type] || [[1e9, 0]];
    for (const [maxKm, fare] of stages) if (dist <= maxKm) return fare;
    return stages[stages.length - 1][1];
  };

  // group route_stops per route in order
  const byRoute = {};
  for (const r of rows) (byRoute[r.route_id] = byRoute[r.route_id] || []).push(r);

  const stopMeta = {};   // stop_id -> {name, lat, lng}
  const routesAtStop = {}; // stop_id -> Set(route_id)
  const adj = {};        // node "route|stop" -> [{to, time}]
  const addEdge = (a, b, time) => { (adj[a] = adj[a] || []).push({ to: b, time }); };

  for (const [rid, stops] of Object.entries(byRoute)) {
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      stopMeta[s.stop_id] = { name: s.stop_name, lat: Number(s.latitude), lng: Number(s.longitude) };
      (routesAtStop[s.stop_id] = routesAtStop[s.stop_id] || new Set()).add(Number(rid));
      const node = `${rid}|${s.stop_id}`;
      if (i > 0) {
        const prev = stops[i - 1];
        addEdge(`${rid}|${prev.stop_id}`, node, s.time_from_prev_min);
        addEdge(node, `${rid}|${prev.stop_id}`, s.time_from_prev_min); // routes run both ways
      }
    }
  }
  // transfer edges: same stop, different route
  for (const [stopId, routeSet] of Object.entries(routesAtStop)) {
    const list = [...routeSet];
    for (const a of list) for (const b of list) if (a !== b)
      addEdge(`${a}|${stopId}`, `${b}|${stopId}`, TRANSFER_MIN);
  }

  return { byRoute, stopMeta, routesAtStop, adj, fareFor, rows };
}

// ---- plan a journey -------------------------------------------------------
router.get("/plan", async (req, res) => {
  const from = parseInt(req.query.from, 10);
  const to = parseInt(req.query.to, 10);
  if (!from || !to) return res.status(400).json({ error: "from and to stop ids are required" });
  if (from === to) return res.status(400).json({ error: "Origin and destination are the same stop" });

  try {
    const g = await loadGraph();
    if (!g.routesAtStop[from] || !g.routesAtStop[to])
      return res.status(404).json({ error: "Stop is not part of the routable network" });

    // route metadata lookups
    const routeInfo = {};
    for (const r of g.rows) routeInfo[r.route_id] = { code: r.code, name: r.route_name, type: r.type, color: r.color_hex };

    // multi-source Dijkstra from every route serving the origin stop
    const dist = {}, prev = {};
    const pq = []; // {node, d}
    for (const rid of g.routesAtStop[from]) {
      const node = `${rid}|${from}`;
      dist[node] = 0; pq.push({ node, d: 0 });
    }
    let endNode = null;
    while (pq.length) {
      let mi = 0;
      for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[mi].d) mi = i;
      const { node, d } = pq.splice(mi, 1)[0];
      if (d > (dist[node] ?? Infinity)) continue;
      const stopId = parseInt(node.split("|")[1], 10);
      if (stopId === to) { endNode = node; break; }
      for (const e of g.adj[node] || []) {
        const nd = d + e.time;
        if (nd < (dist[e.to] ?? Infinity)) { dist[e.to] = nd; prev[e.to] = node; pq.push({ node: e.to, d: nd }); }
      }
    }
    if (!endNode) return res.status(404).json({ error: "No route found between these stops" });

    // reconstruct node path
    const path = [];
    for (let n = endNode; n != null; n = prev[n]) path.unshift(n);

    // split into legs by route
    const legs = [];
    let cur = null;
    for (const node of path) {
      const [rid, sid] = node.split("|").map(Number);
      if (!cur || cur.route_id !== rid) {
        if (cur) cur.transferAfter = true;
        cur = { route_id: rid, ...routeInfo[rid], stops: [] };
        legs.push(cur);
      }
      cur.stops.push({ stop_id: sid, ...g.stopMeta[sid] });
    }
    // a transfer shows up as two consecutive legs sharing the same stop; drop 1-stop pseudo legs
    const realLegs = legs.filter((l) => l.stops.length >= 2);

    let totalFare = 0, totalTime = 0, totalStops = 0;
    const polyline = [];
    const steps = realLegs.map((leg, idx) => {
      // distance + time along this leg
      const seq = g.byRoute[leg.route_id];
      const idxOf = (sid) => seq.findIndex((x) => x.stop_id === sid);
      let legDist = 0, legTime = 0;
      const ids = leg.stops.map((s) => s.stop_id);
      const startI = idxOf(ids[0]), endI = idxOf(ids[ids.length - 1]);
      const lo = Math.min(startI, endI), hi = Math.max(startI, endI);
      for (let i = lo + 1; i <= hi; i++) { legDist += Number(seq[i].distance_from_prev_km); legTime += seq[i].time_from_prev_min; }
      const fare = g.fareFor(leg.type, legDist);
      totalFare += fare; totalTime += legTime; totalStops += (leg.stops.length - 1);
      for (const s of leg.stops) polyline.push({ lat: s.lat, lng: s.lng });
      return {
        leg: idx + 1,
        route_code: leg.code,
        route_name: leg.name,
        type: leg.type,
        color: leg.color,
        board: leg.stops[0].name,
        alight: leg.stops[leg.stops.length - 1].name,
        stops: leg.stops.length - 1,
        distance_km: Number(legDist.toFixed(2)),
        time_min: legTime,
        fare,
      };
    });
    const transfers = Math.max(0, realLegs.length - 1);
    totalTime += transfers * TRANSFER_MIN;

    // best-effort search log (does not block the response)
    db.query(
      `INSERT INTO route_search(from_stop_id,to_stop_id,result_found,recommended_route_id)
       VALUES($1,$2,true,$3)`,
      [from, to, realLegs[0] ? realLegs[0].route_id : null]
    ).catch(() => {});

    res.json({
      from: g.stopMeta[from],
      to: g.stopMeta[to],
      total_fare: totalFare,
      total_time_min: totalTime,
      total_stops: totalStops,
      transfers,
      legs: steps,
      polyline,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
