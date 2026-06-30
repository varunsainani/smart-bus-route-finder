// Thin fetch (AJAX) wrapper used by the whole dashboard.
async function api(path) {
  const res = await fetch(window.API_BASE + path);
  if (!res.ok) {
    let msg = res.status;
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(path + " -> " + msg);
  }
  return res.json();
}

// number helpers
const fmtInt = (n) => Number(n).toLocaleString("en-US");
const fmtPKR = (n) => "PKR " + Number(n).toLocaleString("en-US");
const shortDate = (s) => {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
