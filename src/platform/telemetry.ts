// Anonymous analytics per PRD §10: local-first, no PII, bucketed values,
// toggleable, DNT/GPC respected. Events are batched and sent via sendBeacon.
// No endpoint is configured for this build, so events only log in dev mode —
// the queue, bucketing and consent plumbing are all real.

export type EventName =
  | 'app_open'
  | 'game_start'
  | 'game_end'
  | 'game_abandon'
  | 'confirm_view'
  | 'confirm_result'
  | 'end_action'
  | 'share_intent'
  | 'share_result'
  | 'setting_change'
  | 'error'
  | 'sw_update';

interface Event {
  name: EventName;
  props: Record<string, string | number | boolean>;
  ts: number;
}

const MAX_QUEUE = 10;
const FLUSH_MS = 5_000;
// Self-hosted endpoint would go here (PRD §10.2); empty = telemetry dropped.
const ENDPOINT = '';

let enabled = true;
let queue: Event[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function setAnalyticsEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    queue = [];
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function doNotTrack(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

export function track(name: EventName, props: Record<string, string | number | boolean> = {}): void {
  if (!enabled || doNotTrack()) return;
  queue.push({ name, props, ts: Date.now() });
  if (queue.length >= MAX_QUEUE) flush();
  else if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
}

function flush(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (import.meta.env.DEV) {
    console.debug('[telemetry]', batch.map((e) => e.name).join(','));
    return;
  }
  if (!ENDPOINT) return; // no endpoint configured: drop
  try {
    navigator.sendBeacon(ENDPOINT, JSON.stringify({ events: batch }));
  } catch {
    /* silently dropped */
  }
}

export function flushTelemetry(): void {
  flush();
}

// ---------------------------------------------------------------------------
// Bucketing per PRD §10.2 table 71

export function scoreBucket(score: number): string {
  if (score < 1_000) return '0-999';
  if (score < 5_000) return '1k-4999';
  if (score < 10_000) return '5k-9999';
  if (score < 20_000) return '10k-19999';
  if (score < 50_000) return '20k-49999';
  return '50k+';
}

export function maxTileBucket(maxTile: number): string {
  if (maxTile >= 4096) return '4096+';
  if (maxTile >= 2048) return '2048';
  if (maxTile >= 1024) return '1024';
  if (maxTile >= 512) return '512';
  if (maxTile >= 256) return '256';
  return '128';
}

export function movesBucket(moves: number): string {
  if (moves < 100) return '<100';
  if (moves < 300) return '100-299';
  if (moves < 600) return '300-599';
  if (moves < 1_000) return '600-999';
  return '1000+';
}

export function durationBucket(ms: number): string {
  const m = ms / 60_000;
  if (m < 2) return '<2m';
  if (m < 5) return '2-5m';
  if (m < 10) return '5-10m';
  if (m < 20) return '10-20m';
  if (m < 40) return '20-40m';
  return '40m+';
}

export function deviceClass(): string {
  const w = Math.min(screen.width, screen.height);
  if (w >= 1024) return 'desktop';
  if (w >= 600) return 'tablet';
  return 'mobile';
}
