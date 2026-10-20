import { formatDuration, formatNumber, formatScore, t } from './i18n';

// FR-09: local Canvas share card (1080×1350 PNG), no board layout, no PII.
// Web Share (files) → PNG download → text copy, with graceful degradation.

export interface ShareSummary {
  score: number;
  maxTile: number;
  elapsedMs: number;
  won: boolean;
}

const CARD_W = 1080;
const CARD_H = 1350;

export async function buildShareCard(summary: ShareSummary): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas-2d-unavailable');

  // Background
  g.fillStyle = '#faf8ef';
  g.fillRect(0, 0, CARD_W, CARD_H);

  // Wordmark tile
  const tile = 300;
  const tileX = (CARD_W - tile) / 2;
  const tileY = 160;
  g.fillStyle = '#edc22e';
  g.fillRect(tileX, tileY, tile, tile);
  g.fillStyle = '#3a2e12';
  g.font = '700 120px Arial, "Helvetica Neue", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('2048', CARD_W / 2, tileY + tile / 2);

  // Score
  g.fillStyle = '#2b2b2b';
  g.font = '700 92px Arial, "Helvetica Neue", sans-serif';
  g.fillText(formatScore(summary.score).text, CARD_W / 2, 620);

  // Stats rows
  const rows: Array<[string, string]> = [
    [t('maxTile'), String(summary.maxTile)],
    [t('time'), formatDuration(summary.elapsedMs)],
  ];
  let y = 780;
  g.font = '600 44px Arial, "Helvetica Neue", sans-serif';
  for (const [label, value] of rows) {
    g.textAlign = 'left';
    g.fillStyle = '#6f655b';
    g.fillText(label, 170, y);
    g.textAlign = 'right';
    g.fillStyle = '#2b2b2b';
    g.fillText(value, CARD_W - 170, y);
    y += 100;
  }

  // Date + origin footer (no board, no nickname, no device info — FR-09)
  g.textAlign = 'center';
  g.fillStyle = '#6f655b';
  g.font = '400 36px Arial, "Helvetica Neue", sans-serif';
  const date = new Intl.DateTimeFormat(t('lang')).format(new Date());
  g.fillText(date, CARD_W / 2, 1080);
  g.font = '400 32px Arial, "Helvetica Neue", sans-serif';
  g.fillText(`${location.origin}/`, CARD_W / 2, 1160);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('canvas-toBlob-failed'));
    }, 'image/png');
  });
}

export function buildShareText(summary: ShareSummary): string {
  const text = t('shareText', {
    score: formatNumber(summary.score),
    tile: summary.maxTile,
    duration: formatDuration(summary.elapsedMs),
  });
  return text.length <= 120 ? text : text.slice(0, 119) + '…';
}

export type ShareChannel = 'web_share' | 'download' | 'copy';
export type ShareOutcome = 'success' | 'cancel' | 'fail';

export interface ShareResult {
  outcome: ShareOutcome;
  channel: ShareChannel;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareScore(summary: ShareSummary): Promise<ShareResult> {
  const blob = await buildShareCard(summary);
  const file = new File([blob], '2048-score.png', { type: 'image/png' });
  const text = buildShareText(summary);
  const title = t('title');

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (typeof navigator.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], title, text });
      return { outcome: 'success', channel: 'web_share' };
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return { outcome: 'cancel', channel: 'web_share' };
      }
      // fall through to download
    }
  }

  try {
    downloadBlob(blob, '2048-score.png');
    return { outcome: 'success', channel: 'download' };
  } catch {
    try {
      await copyText(text);
      return { outcome: 'success', channel: 'copy' };
    } catch {
      return { outcome: 'fail', channel: 'copy' };
    }
  }
}
