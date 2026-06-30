// In-process smoke test: start the app, hit key endpoints, report, exit.
require("dotenv").config();
const http = require("http");
const app = require("./app");

const server = http.createServer(app);
const get = (path) => new Promise((resolve) => {
  http.get(`http://127.0.0.1:${server.address().port}${path}`, (r) => {
    let d = ""; r.on("data", (c) => (d += c));
    r.on("end", () => resolve({ status: r.statusCode, body: d }));
  }).on("error", (e) => resolve({ status: 0, body: e.message }));
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const tests = [
    "/api/health",
    "/api/analytics/summary",
    "/api/analytics/ridership-by-route",
    "/api/analytics/modal-split",
    "/api/analytics/peak-hours",
    "/api/analytics/daily-ridership",
    "/api/analytics/top-od-pairs",
    "/api/analytics/on-time-performance",
    "/api/routes?limit=2",
    "/api/finder/stops",
  ];
  let pass = 0;
  for (const t of tests) {
    const r = await get(t);
    const ok = r.status === 200;
    pass += ok ? 1 : 0;
    let preview = r.body.slice(0, 90).replace(/\s+/g, " ");
    console.log(`${ok ? "PASS" : "FAIL"} [${r.status}] ${t}  ${preview}`);
  }
  // route finder: Gulshan-e-Johar -> Sea View (requires transfers)
  const stops = JSON.parse((await get("/api/finder/stops")).body);
  const byName = (n) => stops.find((s) => s.name === n)?.stop_id;
  const from = byName("Gulshan-e-Johar"), to = byName("Sea View");
  const plan = await get(`/api/finder/plan?from=${from}&to=${to}`);
  console.log(`\n${plan.status === 200 ? "PASS" : "FAIL"} [${plan.status}] route plan Gulshan-e-Johar -> Sea View`);
  if (plan.status === 200) {
    const p = JSON.parse(plan.body);
    console.log(`  fare PKR ${p.total_fare}, ${p.total_time_min} min, ${p.total_stops} stops, ${p.transfers} transfer(s)`);
    p.legs.forEach((l) => console.log(`    Leg ${l.leg}: ${l.route_code} ${l.board} -> ${l.alight} (${l.stops} stops, PKR ${l.fare})`));
  } else {
    console.log("  " + plan.body.slice(0, 120));
  }
  console.log(`\n${pass}/${tests.length} endpoint checks passed`);
  server.close();
  process.exit(0);
})();
