// ============================================================================
// Seed the Smart Local Bus Route Finder database.
// Loads the real Karachi BRT + feeder network, then deterministically generates
// realistic operational data (journeys, transactions, feedback, incidents).
// Deterministic PRNG => the same data every run, so results are reproducible.
// Usage: node db/seed.js
// ============================================================================
require("dotenv").config();
const { Client } = require("pg");

// ---- deterministic PRNG (mulberry32) --------------------------------------
let _s = 0x9e3779b9;
function rnd() {
  _s |= 0; _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));   // inclusive int
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function weightedIndex(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

// ---- geo helpers ----------------------------------------------------------
function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ============================================================================
// REFERENCE / NETWORK DATA (real Karachi public transport)
// ============================================================================
const ZONES = [
  ["Central Karachi", "CEN"], ["East Karachi", "EAS"], ["West Karachi", "WES"],
  ["South Karachi", "SOU"], ["Malir", "MAL"], ["Korangi", "KOR"], ["Keamari", "KEA"],
];

const OPERATORS = [
  ["TransKarachi", "TK", "Public-Private", "021-111-825-825", 2016],
  ["Sindh Mass Transit Authority", "SMTA", "Government", "021-99332200", 2014],
  ["Peoples Bus Service", "PBS", "Government", "021-99333100", 2022],
  ["Karachi Breeze Electric", "KBE", "Public-Private", "021-111-202-202", 2023],
];

const ROUTE_TYPES = [
  ["BRT", "#2e7d32", 15, "Bus Rapid Transit with dedicated corridors and stations"],
  ["Feeder", "#f57c00", 50, "Peoples Bus Service feeder routes on mixed traffic"],
  ["Electric", "#c2185b", 50, "Zero emission electric bus service"],
  ["Intercity", "#5e35b1", 120, "Long distance intercity coach service"],
];

// stop name -> [lat, lng, zoneCode, isTerminal]
const COORDS = {
  // Green Line corridor
  "Surjani Town": [25.0150, 67.0680, "WES", true],
  "Abdul Sattar Edhi": [24.9990, 67.0610, "WES", false],
  "Power House": [24.9850, 67.0560, "WES", false],
  "UP More": [24.9720, 67.0530, "CEN", false],
  "Nagan Chowrangi": [24.9610, 67.0610, "CEN", false],
  "4-K Chowrangi": [24.9520, 67.0480, "CEN", false],
  "Board Office": [24.9430, 67.0440, "CEN", false],
  "Sakhi Hassan": [24.9360, 67.0400, "CEN", false],
  "North Nazimabad": [24.9290, 67.0370, "CEN", false],
  "Five Star Chowrangi": [24.9230, 67.0360, "CEN", false],
  "Eidgah": [24.9120, 67.0330, "CEN", false],
  "Nazimabad No.7": [24.9050, 67.0320, "CEN", false],
  "Golimar": [24.8980, 67.0310, "CEN", false],
  "Gurumandir": [24.8900, 67.0330, "CEN", false],
  "Lasbela": [24.8870, 67.0320, "CEN", false],
  "Garden": [24.8840, 67.0290, "SOU", false],
  "Nishtar Road": [24.8820, 67.0300, "SOU", false],
  "Numaish": [24.8807, 67.0299, "CEN", true],
  // Red Line corridor (University Road)
  "Malir Cantt": [24.8930, 67.1900, "MAL", true],
  "Quaidabad": [24.8870, 67.1830, "MAL", false],
  "Drigh Road": [24.8800, 67.1600, "EAS", false],
  "Shah Faisal Colony": [24.8830, 67.1500, "EAS", false],
  "Natha Khan": [24.8850, 67.1400, "EAS", false],
  "Karsaz": [24.8900, 67.1200, "EAS", false],
  "NIPA Chowrangi": [24.9150, 67.0950, "EAS", false],
  "Aladin Park": [24.9120, 67.0820, "EAS", false],
  "Civic Centre": [24.9050, 67.0680, "EAS", false],
  "Hassan Square": [24.9080, 67.0560, "CEN", false],
  "Liaquatabad": [24.9050, 67.0450, "CEN", false],
  "Teen Hatti": [24.8950, 67.0400, "CEN", false],
  // Orange Line
  "Pak Colony": [24.9180, 67.0260, "WES", false],
  "Banaras": [24.9300, 67.0180, "WES", false],
  "Orangi Town": [24.9540, 67.0100, "WES", true],
  // R-10
  "Tower": [24.8470, 67.0030, "SOU", true],
  "Saddar": [24.8600, 67.0290, "SOU", false],
  "Soldier Bazaar": [24.8730, 67.0350, "CEN", false],
  "Jail Chowrangi": [24.8870, 67.0470, "EAS", false],
  "Gulshan Chowrangi": [24.9180, 67.0900, "EAS", false],
  "Gulshan-e-Johar": [24.9230, 67.1300, "EAS", true],
  // R-12
  "Hyderi": [24.9430, 67.0360, "CEN", false],
  // EV-1
  "Clifton": [24.8120, 67.0290, "SOU", false],
  "Do Talwar": [24.8090, 67.0310, "SOU", false],
  "Bilawal House": [24.8200, 67.0330, "SOU", false],
  "Sea View": [24.7980, 67.0250, "SOU", true],
  // EV-3
  "Millennium Mall": [24.9050, 67.1000, "EAS", false],
  "Bahadurabad": [24.8830, 67.0700, "EAS", false],
  "KPT Interchange": [24.8600, 67.0900, "KOR", false],
  "DHA Phase 2": [24.8400, 67.0650, "SOU", false],
  "DHA Phase 5": [24.8000, 67.0500, "SOU", true],
};

// route code -> {name, type, operatorShort, launch, stops:[names in order]}
const ROUTES = {
  "GREEN": { name: "Green Line BRT", type: "BRT", op: "TK", launch: "2021-12-10", stops: [
    "Surjani Town","Abdul Sattar Edhi","Power House","UP More","Nagan Chowrangi","4-K Chowrangi",
    "Board Office","Sakhi Hassan","North Nazimabad","Five Star Chowrangi","Eidgah","Nazimabad No.7",
    "Golimar","Gurumandir","Lasbela","Garden","Nishtar Road","Numaish"] },
  "RED": { name: "Red Line BRT", type: "BRT", op: "SMTA", launch: "2023-06-01", stops: [
    "Malir Cantt","Quaidabad","Drigh Road","Shah Faisal Colony","Natha Khan","Karsaz","NIPA Chowrangi",
    "Aladin Park","Civic Centre","Hassan Square","Liaquatabad","Teen Hatti","Gurumandir","Numaish"] },
  "ORANGE": { name: "Orange Line BRT", type: "BRT", op: "TK", launch: "2022-03-15", stops: [
    "Board Office","Pak Colony","Banaras","Orangi Town"] },
  "R-10": { name: "Peoples Bus R-10", type: "Feeder", op: "PBS", launch: "2022-07-01", stops: [
    "Tower","Saddar","Numaish","Soldier Bazaar","Jail Chowrangi","Gulshan Chowrangi","Gulshan-e-Johar"] },
  "R-12": { name: "Peoples Bus R-12", type: "Feeder", op: "PBS", launch: "2022-08-15", stops: [
    "Nagan Chowrangi","Hyderi","Liaquatabad","Lasbela","Saddar","Tower"] },
  "EV-1": { name: "Electric Bus EV-1", type: "Electric", op: "KBE", launch: "2023-09-01", stops: [
    "Gurumandir","Tower","Clifton","Do Talwar","Bilawal House","Sea View"] },
  "EV-3": { name: "Electric Bus EV-3", type: "Electric", op: "KBE", launch: "2024-01-20", stops: [
    "NIPA Chowrangi","Millennium Mall","Bahadurabad","KPT Interchange","DHA Phase 2","DHA Phase 5"] },
};
const ROUTE_POPULARITY = { "GREEN": 30, "RED": 24, "ORANGE": 6, "R-10": 14, "R-12": 10, "EV-1": 9, "EV-3": 7 };

const BUS_MODELS = [
  ["Daewoo", "BC212MA", 30, 45, "Diesel"],
  ["Zhongtong", "LCK6125", 34, 50, "Diesel"],
  ["Higer", "KLQ6122", 32, 48, "CNG"],
  ["Golden Dragon", "XML6125", 31, 46, "Diesel"],
  ["Foton", "AUV BJ6123", 28, 40, "Hybrid"],
  ["BYD", "K9 Electric", 31, 39, "Electric"],
];

const FIRST = ["Asad","Bilal","Imran","Kamran","Rafay","Salman","Usman","Zeeshan","Adnan","Faisal",
  "Hamza","Junaid","Naveed","Owais","Saad","Talha","Waqas","Yasir","Ahmed","Basit",
  "Ayesha","Fatima","Hira","Kiran","Maria","Nida","Rabia","Sana","Zara","Amna"];
const LAST = ["Khan","Ahmed","Ali","Hussain","Siddiqui","Sheikh","Malik","Qureshi","Memon","Baig",
  "Abbasi","Farooqi","Hashmi","Jamali","Lodhi","Rana","Shah","Tariq","Usmani","Zaidi"];
const fullName = () => `${pick(FIRST)} ${pick(LAST)}`;

// ---- bulk insert helper ---------------------------------------------------
async function insertMany(client, table, cols, rows, batch = 500) {
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of slice) {
      values.push(`(${row.map(() => `$${p++}`).join(",")})`);
      params.push(...row);
    }
    await client.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${values.join(",")}`,
      params
    );
  }
}

// ============================================================================
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected. Seeding...");

  // -- zones
  const zoneId = {};
  for (const [name, code] of ZONES) {
    const r = await client.query(
      "INSERT INTO zone(name,code,description) VALUES($1,$2,$3) RETURNING zone_id",
      [name, code, `${name} administrative zone`]);
    zoneId[code] = r.rows[0].zone_id;
  }

  // -- operators
  const opId = {};
  for (const [name, short, type, phone, year] of OPERATORS) {
    const r = await client.query(
      "INSERT INTO operator(name,short_name,operator_type,contact_phone,established_year) VALUES($1,$2,$3,$4,$5) RETURNING operator_id",
      [name, short, type, phone, year]);
    opId[short] = r.rows[0].operator_id;
  }

  // -- route types
  const typeId = {};
  for (const [name, color, base, desc] of ROUTE_TYPES) {
    const r = await client.query(
      "INSERT INTO route_type(name,color_hex,base_fare,description) VALUES($1,$2,$3,$4) RETURNING route_type_id",
      [name, color, base, desc]);
    typeId[name] = r.rows[0].route_type_id;
  }

  // -- fare stages per type (distance band -> fare)
  const FARE_STAGES = {
    "BRT": [[5, 15], [10, 25], [15, 35], [20, 45], [100, 55]],
    "Feeder": [[100, 50]],
    "Electric": [[100, 50]],
    "Intercity": [[50, 120], [200, 200]],
  };
  for (const [tname, stages] of Object.entries(FARE_STAGES)) {
    for (const [maxKm, fare] of stages) {
      await client.query(
        "INSERT INTO fare_stage(route_type_id,max_distance_km,fare) VALUES($1,$2,$3)",
        [typeId[tname], maxKm, fare]);
    }
  }
  const fareFor = (tname, dist) => {
    const stages = FARE_STAGES[tname];
    for (const [maxKm, fare] of stages) if (dist <= maxKm) return fare;
    return stages[stages.length - 1][1];
  };

  // -- stops (unique master list)
  const stopId = {};
  for (const [name, [lat, lng, zc, term]] of Object.entries(COORDS)) {
    const r = await client.query(
      "INSERT INTO stop(name,zone_id,latitude,longitude,is_terminal,has_shelter) VALUES($1,$2,$3,$4,$5,$6) RETURNING stop_id",
      [name, zoneId[zc] || null, lat, lng, !!term, rnd() > 0.15]);
    stopId[name] = r.rows[0].stop_id;
  }

  // -- routes + route_stops (compute distance/time/fare per segment from coords)
  const routeId = {};
  const routeStops = {};   // code -> [{stopId, seq, cumDist, cumTime}]
  const TIME_PER_KM = { "BRT": 2.2, "Feeder": 3.2, "Electric": 2.8, "Intercity": 1.8 };
  for (const [code, r] of Object.entries(ROUTES)) {
    let totalKm = 0;
    const segs = [];
    for (let i = 0; i < r.stops.length; i++) {
      const here = COORDS[r.stops[i]];
      let dKm = 0;
      if (i > 0) dKm = haversineKm(COORDS[r.stops[i - 1]], here);
      totalKm += dKm;
      segs.push({ name: r.stops[i], dKm });
    }
    const ins = await client.query(
      "INSERT INTO route(code,name,route_type_id,operator_id,length_km,is_active,launch_date) VALUES($1,$2,$3,$4,$5,true,$6) RETURNING route_id",
      [code, r.name, typeId[r.type], opId[r.op], Number(totalKm.toFixed(2)), r.launch]);
    routeId[code] = ins.rows[0].route_id;

    const rsRows = [];
    const list = [];
    let cumDist = 0, cumTime = 0;
    for (let i = 0; i < segs.length; i++) {
      const dKm = segs[i].dKm;
      const tMin = Math.round(dKm * TIME_PER_KM[r.type]) + (i > 0 ? 1 : 0); // +1 min dwell
      const fareSeg = Number((dKm * (r.type === "BRT" ? 2 : 3)).toFixed(2));
      cumDist += dKm; cumTime += tMin;
      rsRows.push([routeId[code], stopId[segs[i].name], i + 1,
        Number(dKm.toFixed(2)), tMin, fareSeg]);
      list.push({ stopId: stopId[segs[i].name], seq: i + 1, cumDist, cumTime });
    }
    await insertMany(client, "route_stop",
      ["route_id", "stop_id", "stop_sequence", "distance_from_prev_km", "time_from_prev_min", "fare_from_prev"],
      rsRows);
    routeStops[code] = list;
  }

  // -- bus models
  const modelIds = [];
  for (const [mfg, model, seat, stand, fuel] of BUS_MODELS) {
    const r = await client.query(
      "INSERT INTO bus_model(manufacturer,model_name,seating_capacity,standing_capacity,fuel_type) VALUES($1,$2,$3,$4,$5) RETURNING bus_model_id",
      [mfg, model, seat, stand, fuel]);
    modelIds.push({ id: r.rows[0].bus_model_id, fuel });
  }
  const electricModel = modelIds.find((m) => m.fuel === "Electric").id;

  // -- buses (assign to routes; electric routes get electric buses)
  const busRows = [];
  const busByRoute = {};
  let busSeq = 1;
  for (const [code, r] of Object.entries(ROUTES)) {
    const count = Math.max(4, Math.round(ROUTE_POPULARITY[code] / 2));
    busByRoute[code] = [];
    for (let i = 0; i < count; i++) {
      const model = r.type === "Electric" ? electricModel : pick(modelIds.filter(m => m.fuel !== "Electric")).id;
      const reg = `JV-${String(1000 + busSeq).slice(-4)}`;
      busRows.push([reg, model, opId[r.op], routeId[code],
        pick(["Active", "Active", "Active", "Maintenance"]),
        "2022-01-01", ri(20000, 180000)]);
      busByRoute[code].push(busSeq); // 1-based ordinal -> resolve to id after insert
      busSeq++;
    }
  }
  await insertMany(client, "bus",
    ["registration_no", "bus_model_id", "operator_id", "route_id", "status", "in_service_date", "odometer_km"],
    busRows);
  const busIdsAll = (await client.query("SELECT bus_id FROM bus ORDER BY bus_id")).rows.map(r => r.bus_id);
  // map ordinal -> real id
  const ordToBusId = {}; busIdsAll.forEach((id, idx) => ordToBusId[idx + 1] = id);

  // -- drivers
  const driverRows = [];
  for (let i = 0; i < 55; i++) {
    const op = pick(Object.values(opId));
    driverRows.push([fullName(), `DL-${ri(100000, 999999)}`, op, `03${ri(100000000, 499999999)}`,
      `2022-${String(ri(1, 12)).padStart(2, "0")}-${String(ri(1, 28)).padStart(2, "0")}`,
      pick(["Morning", "Evening", "Night"])]);
  }
  await insertMany(client, "driver",
    ["full_name", "license_no", "operator_id", "phone", "hire_date", "shift"], driverRows);
  const driverIds = (await client.query("SELECT driver_id FROM driver")).rows.map(r => r.driver_id);

  // -- staff at stops
  const staffRows = [];
  const allStopIds = Object.values(stopId);
  for (let i = 0; i < 35; i++) {
    staffRows.push([fullName(),
      pick(["Station Manager", "Ticketing", "Security", "Cleaning", "Maintenance"]),
      pick(allStopIds), pick(Object.values(opId)),
      `2022-${String(ri(1, 12)).padStart(2, "0")}-${String(ri(1, 28)).padStart(2, "0")}`]);
  }
  await insertMany(client, "staff",
    ["full_name", "role", "stop_id", "operator_id", "hire_date"], staffRows);

  // -- schedules (departure times per route per direction)
  const scheduleRows = [];
  const scheduleMeta = []; // parallel array: {routeCode, durationMin}
  const departures = ["06:30", "07:30", "08:30", "10:00", "12:00", "14:00", "16:30", "18:00", "19:30"];
  for (const [code] of Object.entries(ROUTES)) {
    const rs = routeStops[code];
    const durationMin = rs[rs.length - 1].cumTime;
    const busPool = busByRoute[code].map(o => ordToBusId[o]);
    for (const dir of ["Outbound", "Inbound"]) {
      for (const dep of departures) {
        scheduleRows.push([routeId[code], pick(busPool), pick(driverIds), dep, dir, "Daily"]);
        scheduleMeta.push({ code, durationMin });
      }
    }
  }
  await insertMany(client, "schedule",
    ["route_id", "bus_id", "driver_id", "departure_time", "direction", "day_type"], scheduleRows);
  const scheduleIds = (await client.query("SELECT schedule_id FROM schedule ORDER BY schedule_id")).rows.map(r => r.schedule_id);

  // -- passengers
  const GENDERS = ["Male", "Female", "Other"];
  const passengerRows = [];
  const usedEmail = new Set();
  for (let i = 0; i < 420; i++) {
    const name = fullName();
    let email = `${name.toLowerCase().replace(/[^a-z]/g, ".")}.${i}@mail.com`;
    if (usedEmail.has(email)) email = `user${i}@mail.com`;
    usedEmail.add(email);
    const signupDaysAgo = ri(30, 720);
    passengerRows.push([name, email, `03${ri(100000000, 499999999)}`,
      pick(Object.values(zoneId)),
      new Date(Date.now() - signupDaysAgo * 864e5).toISOString().slice(0, 10),
      GENDERS[weightedIndex([55, 42, 3])]]);
  }
  await insertMany(client, "passenger",
    ["full_name", "email", "phone", "home_zone_id", "signup_date", "gender"], passengerRows);
  const passengerIds = (await client.query("SELECT passenger_id FROM passenger ORDER BY passenger_id")).rows.map(r => r.passenger_id);

  // -- fare cards (one per ~85% of passengers)
  const cardRows = [];
  const cardOfPassenger = {};
  let cardSeq = 1;
  for (const pid of passengerIds) {
    if (rnd() > 0.15) {
      const num = `KB${String(100000 + cardSeq).slice(-6)}`;
      cardRows.push([num, pid, Number((rnd() * 800).toFixed(2)),
        new Date(Date.now() - ri(20, 600) * 864e5).toISOString().slice(0, 10),
        pick(["Active", "Active", "Active", "Active", "Blocked", "Expired"])]);
      cardSeq++;
    }
  }
  await insertMany(client, "fare_card",
    ["card_number", "passenger_id", "balance", "issued_date", "status"], cardRows);
  const cards = (await client.query("SELECT fare_card_id,passenger_id FROM fare_card")).rows;
  for (const c of cards) cardOfPassenger[c.passenger_id] = c.fare_card_id;
  const cardIds = cards.map(c => c.fare_card_id);

  // -- time helpers for the operational window (last 30 days)
  const DAYS = 30;
  const HOUR_WEIGHTS = new Array(24).fill(0);
  [[6,2],[7,6],[8,9],[9,7],[10,4],[11,3],[12,4],[13,4],[14,3],[15,4],
   [16,5],[17,8],[18,9],[19,7],[20,4],[21,3],[22,2]].forEach(([h,w]) => HOUR_WEIGHTS[h]=w);
  function randomBoardTime() {
    // build in UTC so the stored wall-clock hour matches the intended commute hour
    const dayAgo = ri(0, DAYS - 1);
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - dayAgo);
    const h = weightedIndex(HOUR_WEIGHTS);
    d.setUTCHours(h, ri(0, 59), ri(0, 59), 0);
    return d;
  }

  // -- journeys (the main analytics fact table)
  const routeCodes = Object.keys(ROUTES);
  const routeWeights = routeCodes.map(c => ROUTE_POPULARITY[c]);
  const journeyRows = [];
  const fareTxnRows = [];
  const N_JOURNEYS = 6000;
  for (let i = 0; i < N_JOURNEYS; i++) {
    const code = routeCodes[weightedIndex(routeWeights)];
    const rs = routeStops[code];
    if (rs.length < 2) continue;
    let bi = ri(0, rs.length - 2);
    let ai = ri(bi + 1, rs.length - 1);
    const board = rs[bi], alight = rs[ai];
    const dist = alight.cumDist - board.cumDist;
    const timeMin = alight.cumTime - board.cumTime;
    const tname = ROUTES[code].type;
    const fare = fareFor(tname, dist);
    const pid = pick(passengerIds);
    const cardId = cardOfPassenger[pid] || null;
    const bt = randomBoardTime();
    const at = new Date(bt.getTime() + timeMin * 60000);
    const transfers = rnd() < 0.12 ? 1 : 0;
    journeyRows.push([pid, cardId, routeId[code], board.stopId, alight.stopId,
      bt.toISOString(), at.toISOString(), fare, ai - bi, transfers]);
    if (cardId) fareTxnRows.push([cardId, -fare, "Fare", "Card", bt.toISOString()]);
  }
  await insertMany(client, "journey",
    ["passenger_id", "fare_card_id", "route_id", "board_stop_id", "alight_stop_id",
     "board_time", "alight_time", "fare", "num_stops", "transfers"], journeyRows);

  // -- card transactions: fares (above) + top-ups
  const txnRows = [...fareTxnRows];
  for (const cardId of cardIds) {
    const nTop = ri(1, 5);
    for (let i = 0; i < nTop; i++) {
      const amt = pick([100, 200, 300, 500, 500, 1000]);
      const t = new Date(Date.now() - ri(0, DAYS) * 864e5 - ri(0, 86400) * 1000);
      txnRows.push([cardId, amt, "TopUp", pick(["Cash", "EasyPaisa", "JazzCash", "BankApp", "Card"]), t.toISOString()]);
    }
  }
  await insertMany(client, "card_transaction",
    ["fare_card_id", "amount", "txn_type", "payment_method", "txn_time"], txnRows);

  // -- trip logs (one per schedule per service date in the window)
  const tripRows = [];
  for (let s = 0; s < scheduleIds.length; s++) {
    const meta = scheduleMeta[s];
    const pop = ROUTE_POPULARITY[meta.code];
    for (let dayAgo = 0; dayAgo < DAYS; dayAgo++) {
      const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - dayAgo);
      const [dh, dm] = scheduleRows[s][3].split(":").map(Number);
      const dep = new Date(d); dep.setUTCHours(dh, dm + ri(-3, 8), 0, 0);
      const arr = new Date(dep.getTime() + meta.durationMin * 60000);
      const onTime = rnd() > 0.16;
      const pax = Math.max(5, Math.round((pop * 1.2) + ri(-8, 14)));
      tripRows.push([scheduleIds[s], d.toISOString().slice(0, 10),
        dep.toISOString(), arr.toISOString(), pax, onTime]);
    }
  }
  await insertMany(client, "trip_log",
    ["schedule_id", "service_date", "actual_departure", "actual_arrival", "passenger_count", "on_time"], tripRows);

  // -- route searches (popular OD pairs from real interchanges)
  const searchRows = [];
  const allStops = Object.entries(stopId);
  const HUBS = ["Numaish", "Saddar", "Gulshan-e-Johar", "Sea View", "NIPA Chowrangi", "Tower", "Nagan Chowrangi"];
  for (let i = 0; i < 3200; i++) {
    const useHub = rnd() < 0.6;
    const to = useHub ? stopId[pick(HUBS)] : pick(allStops)[1];
    const from = pick(allStops)[1];
    if (from === to) continue;
    const pid = rnd() < 0.7 ? pick(passengerIds) : null;
    const found = rnd() > 0.08;
    const rec = found ? routeId[pick(routeCodes)] : null;
    const t = new Date(Date.now() - ri(0, DAYS) * 864e5 - ri(0, 86400) * 1000);
    searchRows.push([pid, from, to, t.toISOString(), found, rec]);
  }
  await insertMany(client, "route_search",
    ["passenger_id", "from_stop_id", "to_stop_id", "searched_at", "result_found", "recommended_route_id"], searchRows);

  // -- feedback (positively skewed ratings)
  const feedbackRows = [];
  const CATS = ["Cleanliness", "Punctuality", "Driver", "Safety", "Crowding", "App", "Other"];
  const COMMENTS = ["Great service", "Bus was on time", "Too crowded at peak", "Clean and comfortable",
    "Driver was polite", "App made it easy", "Long wait today", "Smooth ride", "Needs more buses", "Very affordable"];
  for (let i = 0; i < 850; i++) {
    const rating = weightedIndex([3, 6, 14, 33, 44]) + 1; // skew to 4-5
    feedbackRows.push([pick(passengerIds), routeId[pick(routeCodes)], null,
      rating, pick(CATS), pick(COMMENTS),
      new Date(Date.now() - ri(0, DAYS) * 864e5).toISOString()]);
  }
  await insertMany(client, "feedback",
    ["passenger_id", "route_id", "journey_id", "rating", "category", "comment", "created_at"], feedbackRows);

  // -- incidents
  const incidentRows = [];
  const ITYPES = ["Breakdown", "Accident", "Delay", "Overcrowding", "Weather", "Protest", "Other"];
  const SEV = ["Low", "Medium", "High", "Critical"];
  for (let i = 0; i < 130; i++) {
    const reported = new Date(Date.now() - ri(0, DAYS) * 864e5 - ri(0, 86400) * 1000);
    const resolved = rnd() > 0.2 ? new Date(reported.getTime() + ri(20, 600) * 60000) : null;
    incidentRows.push([routeId[pick(routeCodes)], pick(allStopIds),
      ITYPES[weightedIndex([20, 6, 34, 22, 8, 5, 5])], SEV[weightedIndex([45, 35, 15, 5])],
      reported.toISOString(), resolved ? resolved.toISOString() : null,
      "Logged by control room"]);
  }
  await insertMany(client, "incident",
    ["route_id", "stop_id", "incident_type", "severity", "reported_at", "resolved_at", "description"], incidentRows);

  // -- maintenance
  const maintRows = [];
  const MTYPES = ["Routine", "Repair", "Inspection", "Tyre", "Engine", "Electrical"];
  for (let i = 0; i < 160; i++) {
    maintRows.push([pick(busIdsAll),
      new Date(Date.now() - ri(0, 120) * 864e5).toISOString().slice(0, 10),
      pick(MTYPES), Number((rnd() * 45000 + 2000).toFixed(2)), "Workshop record"]);
  }
  await insertMany(client, "maintenance",
    ["bus_id", "maintenance_date", "maintenance_type", "cost", "notes"], maintRows);

  // -- summary
  const tables = ["zone","operator","route_type","route","stop","route_stop","fare_stage",
    "bus_model","bus","driver","staff","schedule","trip_log","maintenance",
    "passenger","fare_card","card_transaction","journey","route_search","feedback","incident"];
  console.log("\nRow counts:");
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`  ${t.padEnd(18)} ${r.rows[0].n}`);
  }
  await client.end();
  console.log("\nSeed complete.");
})().catch((e) => { console.error("Seed error:", e); process.exit(1); });
