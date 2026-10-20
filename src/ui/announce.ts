import { dirLabel, formatDuration, formatNumber, t } from '../platform/i18n';

// aria-live announcements (FR-12): one summary per move; concise/verbose
// modes; no fixed-throttle information loss.

let announcer: HTMLElement | null = null;

export function initAnnounce(): void {
  announcer = document.querySelector<HTMLElement>('#announcer');
}

export function announce(text: string): void {
  if (!announcer) return;
  // Toggle content to force re-announcement of identical consecutive text.
  announcer.textContent = '';
  requestAnimationFrame(() => {
    if (announcer) announcer.textContent = text;
  });
}

/** FR-01: first-load announcement for screen-reader users. */
export function announceGameIntro(score: number, best: number): void {
  announce(
    `2048 Open Edition。${t('newGame')}。4 × 4。${t('score')} ${formatNumber(score)}。${t('best')} ${formatNumber(best)}。`,
  );
}

export function announceMove(
  dir: string,
  merges: number,
  score: number,
  maxTile: number,
  verbose: boolean,
  mergeDetails: string[],
): void {
  const summary = t('announceMove', {
    direction: dirLabel(dir),
    merges,
    score: formatNumber(score),
    tile: maxTile,
  });
  announce(verbose && mergeDetails.length > 0 ? `${summary} ${mergeDetails.join(' ')}` : summary);
}

export function announceWin(score: number, maxTile: number, elapsedMs: number): void {
  announce(t('announceWin', { score: formatNumber(score), tile: maxTile, duration: formatDuration(elapsedMs) }));
}

export function announceLose(score: number, maxTile: number): void {
  announce(t('announceLose', { score: formatNumber(score), tile: maxTile }));
}
