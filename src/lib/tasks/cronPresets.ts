import { CronExpressionParser } from "cron-parser";

export const CRON_PRESETS: Array<{ label: string; cron: string }> = [
  { label: "Daily at 9:00", cron: "0 9 * * *" },
  { label: "Daily at 18:00", cron: "0 18 * * *" },
  { label: "Weekdays at 8:00", cron: "0 8 * * 1-5" },
  { label: "Every Monday at 9:00", cron: "0 9 * * 1" },
  { label: "Every Friday at 17:00", cron: "0 17 * * 5" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function describeDow(dow: string): string {
  if (dow === "*") return "every day";
  if (dow === "1-5") return "weekdays";
  if (dow === "0,6" || dow === "6,0") return "weekends";
  const parts = dow.split(",").map((s) => s.trim());
  if (parts.every((p) => /^\d$/.test(p))) {
    return parts
      .map((p) => DAYS[Number(p) % 7] ?? p)
      .join(", ");
  }
  return `dow ${dow}`;
}

export function describeCron(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.cron === cron);
  if (preset) return preset.label;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (min === "0" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Hourly";
  }
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    dom === "*" &&
    mon === "*"
  ) {
    return `${describeDow(dow)} at ${pad2(Number(hour))}:${pad2(Number(min))}`;
  }
  if (min.startsWith("*/") && hour === "*") {
    return `Every ${min.slice(2)} minutes`;
  }
  if (hour.startsWith("*/") && min === "0") {
    return `Every ${hour.slice(2)} hours`;
  }
  return cron;
}

export function nextRuns(
  cron: string,
  count: number,
  after?: Date,
): Date[] {
  try {
    const it = CronExpressionParser.parse(cron, {
      currentDate: after ?? new Date(),
    });
    const out: Date[] = [];
    for (let i = 0; i < count; i++) {
      out.push(it.next().toDate());
    }
    return out;
  } catch {
    return [];
  }
}

export function isValidCron(cron: string): boolean {
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}
