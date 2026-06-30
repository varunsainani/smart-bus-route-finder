// Builds every chart on the dashboard from the analytics API (Chart.js).
const Charts = (() => {
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
  Chart.defaults.color = "#6b7785";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;

  const TEAL = "#0f766e";
  const PALETTE = ["#0f766e", "#2e7d32", "#f57c00", "#c2185b", "#5e35b1", "#0284c7", "#d97706", "#be123c", "#0891b2", "#65a30d"];
  const gridX = { grid: { display: false } };
  const gridY = { grid: { color: "#eef2f1" }, beginAtZero: true };

  function fill(ctx, hex) {
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, hex + "55");
    g.addColorStop(1, hex + "05");
    return g;
  }

  async function bar(id, path, { labelKey, valueKey, colorKey, color, label, horizontal } = {}) {
    const rows = await api(path);
    const colors = rows.map((r, i) => (colorKey && r[colorKey]) ? r[colorKey] : (color || PALETTE[i % PALETTE.length]));
    new Chart(document.getElementById(id), {
      type: "bar",
      data: {
        labels: rows.map((r) => r[labelKey]),
        datasets: [{ label, data: rows.map((r) => Number(r[valueKey])), backgroundColor: colors, borderRadius: 6, maxBarThickness: 46 }],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: horizontal ? { y: gridX, x: gridY } : { x: gridX, y: gridY },
      },
    });
  }

  async function donut(id, path, { labelKey, valueKey, colorKey, type = "doughnut" } = {}) {
    const rows = await api(path);
    new Chart(document.getElementById(id), {
      type,
      data: {
        labels: rows.map((r) => r[labelKey]),
        datasets: [{
          data: rows.map((r) => Number(r[valueKey])),
          backgroundColor: rows.map((r, i) => (colorKey && r[colorKey]) ? r[colorKey] : PALETTE[i % PALETTE.length]),
          borderWidth: 2, borderColor: "#fff",
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: type === "doughnut" ? "60%" : 0,
        plugins: { legend: { position: "right" } },
      },
    });
  }

  async function area(id, path, { labelKey, valueKey, color, label, fmtLabel } = {}) {
    const rows = await api(path);
    const ctx = document.getElementById(id).getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: rows.map((r) => fmtLabel ? fmtLabel(r[labelKey]) : r[labelKey]),
        datasets: [{
          label, data: rows.map((r) => Number(r[valueKey])),
          borderColor: color, backgroundColor: fill(ctx, color),
          borderWidth: 2.5, fill: true, tension: 0.35,
          pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: color,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ...gridX, ticks: { maxTicksLimit: 8 } }, y: gridY },
      },
    });
  }

  async function renderAll() {
    await Promise.all([
      bar("ridershipChart", "/api/analytics/ridership-by-route", { labelKey: "code", valueKey: "rides", colorKey: "color", label: "Rides" }),
      area("dailyRidershipChart", "/api/analytics/daily-ridership", { labelKey: "day", valueKey: "rides", color: TEAL, label: "Rides", fmtLabel: shortDate }),
      donut("modalChart", "/api/analytics/modal-split", { labelKey: "type", valueKey: "rides", colorKey: "color" }),
      donut("fuelChart", "/api/analytics/fleet-fuel-mix", { labelKey: "fuel_type", valueKey: "buses", type: "pie" }),
      donut("paymentChart", "/api/analytics/payment-methods", { labelKey: "payment_method", valueKey: "total" }),
      area("revenueChart", "/api/analytics/daily-revenue", { labelKey: "day", valueKey: "revenue", color: "#2e7d32", label: "Revenue", fmtLabel: shortDate }),
      area("peakChart", "/api/analytics/peak-hours", { labelKey: "hour", valueKey: "rides", color: "#f57c00", label: "Passengers", fmtLabel: (h) => h + ":00" }),
      bar("stopsChart", "/api/analytics/busiest-stops", { labelKey: "name", valueKey: "boardings", color: "#0284c7", horizontal: true, label: "Boardings" }),
      bar("odChart", "/api/analytics/top-od-pairs", { labelKey: "to_stop", valueKey: "searches", color: "#5e35b1", horizontal: true, label: "Searches" }),
      bar("onTimeChart", "/api/analytics/on-time-performance", { labelKey: "code", valueKey: "on_time_pct", color: "#14b8a6", label: "On time %" }),
      bar("ratingChart", "/api/analytics/rating-by-route", { labelKey: "code", valueKey: "avg_rating", color: "#d97706", label: "Avg rating" }),
      bar("incidentChart", "/api/analytics/incidents-by-type", { labelKey: "incident_type", valueKey: "total", color: "#be123c", label: "Incidents" }),
    ]);
  }

  return { renderAll };
})();
