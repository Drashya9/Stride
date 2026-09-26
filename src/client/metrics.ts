import type { MetricName } from "@/lib/constants";

/**
 * Client timing collection for BENCHMARKS.md. Samples at
 * NEXT_PUBLIC_METRICS_SAMPLE_RATE, batches, and flushes every few seconds
 * (and on page hide) so measuring never slows the UI down.
 */

type Metric = { name: MetricName; valueMs: number; tags?: Record<string, string> };

const SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_METRICS_SAMPLE_RATE ?? "1");
const queue: Metric[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(useBeacon = false) {
  timer = null;
  while (queue.length) {
    const body = JSON.stringify({ metrics: queue.splice(0, 50) });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/metrics", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(
        () => {},
      );
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flush(true));
}

export function track(name: MetricName, valueMs: number, tags?: Record<string, string>) {
  if (typeof window === "undefined" || !(Math.random() < SAMPLE_RATE)) return;
  queue.push({ name, valueMs: Math.round(valueMs * 10) / 10, tags });
  if (!timer) timer = setTimeout(() => flush(), 5000);
}

/** Runs `cb` after the browser has painted the current update. */
export function afterPaint(cb: () => void) {
  requestAnimationFrame(() => setTimeout(cb, 0));
}
