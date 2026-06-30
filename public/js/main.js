// Boots the dashboard: connection status, KPI cards, charts, and route finder.
const KPIS = [
  { key: "total_routes",     label: "Active routes",        icon: "bi-signpost-2-fill", cls: "c1" },
  { key: "total_stops",      label: "Network stops",        icon: "bi-geo-alt-fill",    cls: "c6" },
  { key: "network_km",       label: "Network length (km)",  icon: "bi-rulers",          cls: "c2" },
  { key: "total_passengers", label: "Registered riders",    icon: "bi-people-fill",     cls: "c5" },
  { key: "total_journeys",   label: "Journeys (30 days)",   icon: "bi-ticket-perforated-fill", cls: "c3" },
  { key: "total_revenue",    label: "Fare revenue (PKR)",   icon: "bi-cash-stack",      cls: "c2", money: true },
  { key: "avg_rating",       label: "Average rating",       icon: "bi-star-fill",       cls: "c7" },
  { key: "on_time_pct",      label: "On-time performance",  icon: "bi-stopwatch-fill",  cls: "c8", pct: true },
];

function renderKpis(s) {
  const row = document.getElementById("kpiRow");
  row.innerHTML = KPIS.map((k) => {
    let v = s[k.key];
    if (k.money) v = fmtInt(v);
    else if (k.pct) v = v + "%";
    else if (!isNaN(v)) v = fmtInt(v);
    return `
      <div class="col-6 col-md-4 col-xl-3">
        <div class="kpi ${k.cls}">
          <i class="bi ${k.icon} kpi-icon"></i>
          <div class="kpi-val">${v}</div>
          <div class="kpi-label">${k.label}</div>
        </div>
      </div>`;
  }).join("");
}

async function setStatus() {
  const pill = document.getElementById("dbStatus");
  try {
    await api("/api/health");
    pill.className = "status-pill ok";
    pill.innerHTML = `<span class="dot"></span> database connected`;
  } catch (e) {
    pill.className = "status-pill err";
    pill.innerHTML = `<span class="dot"></span> database offline`;
  }
}

(async function boot() {
  setStatus();
  try {
    const summary = await api("/api/analytics/summary");
    renderKpis(summary);
  } catch (e) {
    document.getElementById("kpiRow").innerHTML =
      `<div class="col-12"><div class="alert alert-warning mb-0">Could not load analytics: ${e.message}</div></div>`;
  }
  Charts.renderAll().catch((e) => console.error("charts", e));
  Finder.init().catch((e) => console.error("finder", e));
})();
