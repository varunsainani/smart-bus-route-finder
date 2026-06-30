// Route finder: stop pickers, Dijkstra plan request, itinerary panel + Leaflet map.
const Finder = (() => {
  let map, journeyLayer, stops = [];

  function initMap() {
    map = L.map("map", { scrollWheelZoom: false }).setView([24.89, 67.05], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors", maxZoom: 18,
    }).addTo(map);
    journeyLayer = L.layerGroup().addTo(map);
  }

  function fillSelect(el, selectedId) {
    el.innerHTML = "";
    for (const s of stops) {
      const o = document.createElement("option");
      o.value = s.stop_id;
      o.textContent = s.name + (s.routes && s.routes[0] ? `  (${s.routes.join(", ")})` : "");
      if (String(s.stop_id) === String(selectedId)) o.selected = true;
      el.appendChild(o);
    }
  }

  async function loadStops() {
    stops = await api("/api/finder/stops");
    const from = document.getElementById("fromStop");
    const to = document.getElementById("toStop");
    fillSelect(from);
    fillSelect(to);
    // sensible defaults that need a transfer (showcases the engine)
    const byName = (n) => (stops.find((s) => s.name === n) || {}).stop_id;
    from.value = byName("Gulshan-e-Johar") || stops[0].stop_id;
    to.value = byName("Sea View") || stops[stops.length - 1].stop_id;
  }

  function marker(p, color, label) {
    return L.circleMarker([p.lat, p.lng], {
      radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1,
    }).bindTooltip(label, { permanent: false });
  }

  function drawJourney(plan) {
    journeyLayer.clearLayers();
    const all = [];
    let off = 0;
    plan.legs.forEach((leg) => {
      const n = leg.stops + 1;
      const seg = plan.polyline.slice(off, off + n).map((p) => [p.lat, p.lng]);
      off += n;
      if (seg.length > 1) {
        L.polyline(seg, { color: leg.color, weight: 5, opacity: 0.9 }).addTo(journeyLayer);
      }
      seg.forEach((c) => all.push(c));
    });
    const pts = plan.polyline;
    if (pts.length) {
      marker(pts[0], "#16a34a", "Start: " + plan.from.name).addTo(journeyLayer);
      marker(pts[pts.length - 1], "#dc2626", "End: " + plan.to.name).addTo(journeyLayer);
    }
    if (all.length) map.fitBounds(all, { padding: [40, 40] });
  }

  function renderPlan(plan) {
    const el = document.getElementById("planResult");
    const legHtml = plan.legs.map((l, i) => `
      <div class="leg">
        <span class="leg-badge" style="background:${l.color}">${l.route_code}</span>
        <div class="leg-body">
          <div class="route-name">${l.route_name}</div>
          <div class="od">${l.board} &rarr; ${l.alight}</div>
          <div class="meta">${l.stops} stops &middot; ${l.time_min} min &middot; PKR ${l.fare}</div>
        </div>
      </div>
      ${i < plan.legs.length - 1 ? `<div class="transfer-note"><i class="bi bi-arrow-left-right me-1"></i>Transfer</div>` : ""}
    `).join("");

    el.innerHTML = `
      <div class="plan-summary">
        <div class="plan-stat"><div class="v">PKR ${plan.total_fare}</div><div class="l">Fare</div></div>
        <div class="plan-stat"><div class="v">${plan.total_time_min}</div><div class="l">Minutes</div></div>
        <div class="plan-stat"><div class="v">${plan.total_stops}</div><div class="l">Stops</div></div>
        <div class="plan-stat"><div class="v">${plan.transfers}</div><div class="l">Transfers</div></div>
      </div>
      ${legHtml}`;
    drawJourney(plan);
  }

  async function findRoute() {
    const from = document.getElementById("fromStop").value;
    const to = document.getElementById("toStop").value;
    const el = document.getElementById("planResult");
    const btn = document.getElementById("findBtn");
    if (from === to) { el.innerHTML = `<div class="plan-error">Please choose two different stops.</div>`; return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Finding...`;
    try {
      const plan = await api(`/api/finder/plan?from=${from}&to=${to}`);
      renderPlan(plan);
    } catch (e) {
      el.innerHTML = `<div class="plan-error">${e.message.includes("No route") ? "No route found between these stops." : "Could not plan this journey."}</div>`;
    } finally {
      btn.disabled = false; btn.innerHTML = `<i class="bi bi-search me-2"></i>Find route`;
    }
  }

  async function init() {
    initMap();
    await loadStops();
    document.getElementById("findBtn").addEventListener("click", findRoute);
    document.getElementById("swapBtn").addEventListener("click", () => {
      const f = document.getElementById("fromStop"), t = document.getElementById("toStop");
      const tmp = f.value; f.value = t.value; t.value = tmp;
    });
    findRoute(); // show the default journey on load
  }

  return { init };
})();
