import type { Messages } from './messages';
import { en, zhCN } from './messages';

const TABLE: Record<string, Messages> = { en, 'zh-CN': zhCN, 'zh-cn': zhCN, zh: zhCN };

export type Lang = 'en' | 'zh-CN';

function matchLang(navigatorLangs: readonly string[] | undefined): Lang {
  if (!navigatorLangs || navigatorLangs.length === 0) return 'en';
  for (const l of navigatorLangs) {
    const base = l.split('-')[0]!.toLowerCase();
    if (base === 'zh') return 'zh-CN';
    if (base === 'en') return 'en';
  }
  return 'en';
}

let current: Messages = en;

export function detectLang(navigatorLangs?: readonly string[]): Lang {
  return matchLang(navigatorLangs);
}

export function setLang(lang: Lang): void {
  current = TABLE[lang] ?? en;
  document.documentElement.lang = current.lang;
  document.title = current.title;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta) meta.content = current.metaDescription;
}

export function t(key: keyof Messages, params: Record<string, string | number> = {}): string {
  let s: string = current[key] as string;
  for (const [k, v] of Object.entries(params)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(current.lang).format(n);
}

export function dirLabel(dir: string): string {
  return current.moveDirection[dir] ?? dir;
}

/** Compact form above 1,000,000 per PRD §6.5 (full value via aria-label). */
export function formatScore(n: number): { text: string; full: string } {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const digits = m >= 100 ? 0 : m >= 10 ? 1 : 2;
    return { text: `${m.toFixed(digits)}M`, full: formatNumber(n) };
  }
  return { text: formatNumber(n), full: formatNumber(n) };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return t('duration', { m, s });
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(current.lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts));
}
