export const TZ_LABEL = "Europe/Paris";
export const nowIso = () => new Date().toISOString();
export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function fmtParis(iso, opts = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { timeZone: TZ_LABEL, day: "2-digit", month: "2-digit", year: opts.year ? "numeric" : undefined, hour: "2-digit", minute: "2-digit" });
}
export function fmtHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ_LABEL, hour: "2-digit", minute: "2-digit" });
}
export function fmtJour(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" });
}
export function fmtMois(ym) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function downloadBlob(filename, blob) {
  const a = document.createElement("a"); const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** Convertit « AAAA-MM-JJTHH:MM » saisi en heure de Paris vers ISO UTC. */
export function parisLocalToIso(local) {
  const [d, t] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  let guess = Date.UTC(y, mo - 1, da, h, mi);
  for (let k = 0; k < 2; k++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_LABEL, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const g = (x) => Number(parts.find((p) => p.type === x).value);
    const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    guess += Date.UTC(y, mo - 1, da, h, mi) - shown;
  }
  return new Date(guess).toISOString();
}
export function isoToParisLocal(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_LABEL, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (x) => parts.find((p) => p.type === x).value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
