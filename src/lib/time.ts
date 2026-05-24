const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";

  const now = Date.now();
  const diffMs = ts - now;
  const past = diffMs <= 0;
  const abs = Math.abs(diffMs);

  if (abs < MINUTE) return past ? "just now" : "in a moment";

  if (abs < HOUR) {
    const m = Math.round(abs / MINUTE);
    return past ? `${m}m ago` : `in ${m}m`;
  }

  if (abs < DAY) {
    const h = Math.round(abs / HOUR);
    return past ? `${h}h ago` : `in ${h}h`;
  }

  if (abs < 2 * DAY) {
    return past ? "yesterday" : "tomorrow";
  }

  const d = Math.round(abs / DAY);
  if (d < 30) return past ? `${d}d ago` : `in ${d}d`;

  const months = Math.round(d / 30);
  if (months < 12) return past ? `${months}mo ago` : `in ${months}mo`;

  const years = Math.round(d / 365);
  return past ? `${years}y ago` : `in ${years}y`;
}

export function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
