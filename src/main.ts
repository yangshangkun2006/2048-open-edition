import './style.css';
import type { Dir, GameState } from './core';
import { applyMove, continueGame, newGame, newSeed } from './core';
import { detectLang, formatDuration, formatNumber, formatScore, setLang, t } from './platform/i18n';
import {
  DEFAULT_PREFS,
  KEY_GAME,
  KEY_PREFS,
  deleteAllData,
  exportData,
  flushSave,
  getBest,
  loadGame,
  loadPrefs,
  resetBest,
  saveGame,
  savePrefs,
  setBest,
  store,
  type Prefs,
} from './platform/storage';
import { acquireLease, canWrite, initMultiTab } from './platform/multitab';
import {
  deviceClass,
  durationBucket,
  flushTelemetry,
  maxTileBucket,
  movesBucket,
  scoreBucket,
  setAnalyticsEnabled,
  track,
} from './platform/telemetry';
import { playLose, playMerge, playMove, playWin, setSoundEnabled, unlockAudio } from './platform/sounds';
import { shareScore, type ShareSummary } from './platform/share';
import { Renderer, diffEffects } from './ui/renderer';
import { initInput } from './ui/input';
import { closeOverlay, closeTop, isModalOpen, openOverlay } from './ui/overlays';
import { announce, announceGameIntro, announceLose, announceMove, announceWin, initAnnounce } from './ui/announce';

const APP_VERSION = 'v2.0.0';

// ---------------------------------------------------------------------------
// Elements

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const scoreEl = $('score');
const bestEl = $('best');
const introEl = $('notice-intro');
const restoredEl = $('notice-restored');
const toastEl = $('notice-toast');
const errorEl = $('notice-error');
const readonlyEl = $('notice-readonly');
const updateEl = $('notice-update');
const boardEl = $('board');
const endEl = $('overlay-end');
const endTitle = $<HTMLElement>('end-title');
const endSub = $<HTMLElement>('end-sub');
const endStats = $('end-stats');
const keepGoingBtn = $<HTMLButtonElement>('btn-keep-going');
const tryAgainBtn = $<HTMLButtonElement>('btn-try-again');
const shareBtn = $<HTMLButtonElement>('btn-share');
const confirmEl = $('overlay-confirm');
const settingsEl = $('overlay-settings');
const boardInfoEl = $('overlay-boardinfo');
const boardInfoTable = $<HTMLTableElement>('boardinfo-table');
const genericConfirmEl = $('overlay-generic-confirm');
const genericConfirmTitle = $<HTMLElement>('generic-confirm-title');
const appVersionEl = $('app-version');
const settingsVersionEl = $('settings-version');

// ---------------------------------------------------------------------------
// State

let state: GameState;
let best = 0;
let prefs: Prefs = { ...DEFAULT_PREFS };
let readOnly = false;
let lastInputMethod: 'keyboard' | 'touch' = 'keyboard';
let winMoves = 0;
let beatBestThisRun = false;
let timerRunning = false;
let runningSince = 0;
let baseElapsed = 0;
let currentErrorCode = '';

const renderer = new Renderer(boardEl);

function currentElapsed(): number {
  return timerRunning ? baseElapsed + (performance.now() - runningSince) : baseElapsed;
}

function pauseTimer(): void {
  if (!timerRunning) return;
  baseElapsed = currentElapsed();
  timerRunning = false;
}

function resumeTimer(): void {
  if (state.moves === 0) return; // timing starts on the first valid move (§6.2)
  if (state.status !== 'PLAYING' && state.status !== 'POST_WIN') return;
  if (document.hidden) return;
  timerRunning = true;
  runningSince = performance.now();
}

function stopTimer(): void {
  pauseTimer();
  state.elapsedMs = baseElapsed;
}

function persist(): void {
  if (!canWrite()) return;
  state.updatedAt = Date.now();
  state.elapsedMs = currentElapsed();
  saveGame(state);
}

// ---------------------------------------------------------------------------
// Score / best display

function updateScore(): void {
  const s = formatScore(state.score);
  scoreEl.textContent = s.text;
  scoreEl.setAttribute('aria-label', s.full);
}

function updateBest(flash = false): void {
  const s = formatScore(best);
  bestEl.textContent = s.text;
  bestEl.setAttribute('aria-label', s.full);
  if (flash) {
    bestEl.classList.add('best-flash');
    setTimeout(() => bestEl.classList.remove('best-flash'), 800);
  }
}

// ---------------------------------------------------------------------------
// Toast / notices

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3000);
}

function showRestoredNotice(): void {
  restoredEl.classList.remove('hidden');
  setTimeout(() => restoredEl.classList.add('hidden'), 2000);
}

function hideIntroHint(): void {
  introEl.classList.add('fade-out');
  setTimeout(() => introEl.classList.add('hidden'), 200);
  prefs.introSeen = true;
  savePrefs(prefs);
}

// ---------------------------------------------------------------------------
// Game actions

function fireGameEnd(result: 'win' | 'lose' | 'abandon'): void {
  const finalResult = state.won ? 'win' : result;
  track('game_end', {
    result: finalResult,
    won: state.won,
    score_bucket: scoreBucket(state.score),
    max_tile: maxTileBucket(state.maxTile),
    moves_bucket: movesBucket(state.moves),
    duration_bucket: durationBucket(currentElapsed()),
    post_win_moves_bucket: state.won ? movesBucket(Math.max(0, state.moves - winMoves)) : movesBucket(0),
    input_method: lastInputMethod,
    mode: 'classic',
  });
}

function newGameNow(): void {
  state = newGame(newSeed().seed);
  baseElapsed = 0;
  timerRunning = false;
  beatBestThisRun = false;
  winMoves = 0;
  renderer.clear();
  renderer.render(state, null, null);
  updateScore();
  persist();
  track('game_start', { mode: 'classic', resumed: false, source: 'ui' });
}

function confirmNew(): void {
  closeOverlay(confirmEl);
  track('confirm_result', { result: 'confirm' });
  if (state.moves > 0) {
    track('game_abandon', {
      moves: movesBucket(state.moves),
      score: scoreBucket(state.score),
      max_tile: maxTileBucket(state.maxTile),
      duration_bucket: durationBucket(currentElapsed()),
    });
    fireGameEnd('abandon');
  }
  newGameNow();
}

function restart(): void {
  if (state.moves > 0 && (state.status === 'PLAYING' || state.status === 'POST_WIN')) {
    track('confirm_view', {});
    openOverlay(confirmEl, { focus: $('btn-keep-playing') });
    return;
  }
  if (state.moves > 0 && state.status === 'WON') fireGameEnd('win');
  if (!endEl.classList.contains('hidden')) closeOverlay(endEl);
  newGameNow();
}

function keepGoing(): void {
  state = continueGame(state);
  closeOverlay(endEl);
  resumeTimer();
  persist();
  track('end_action', { action: 'continue' });
}

function move(dir: Dir, source: 'keyboard' | 'touch'): boolean {
  if (isModalOpen() || readOnly) return false;
  const prev = state;
  const next = applyMove(prev, dir);
  if (next === prev) return false;
  lastInputMethod = source;

  const effects = diffEffects(prev, next);
  state = next;

  if (prev.moves === 0) {
    state.startedAt = Date.now();
    resumeTimer();
    hideIntroHint();
  }

  const firstWin = next.won && !prev.won;
  if (firstWin) {
    winMoves = next.moves;
    stopTimer();
    playWin();
  } else if (next.status === 'OVER') {
    stopTimer();
    playLose();
  }

  const maxMerge = effects.merged.reduce((m, x) => Math.max(m, x.value), 0);
  playMove();
  if (effects.merged.length > 0) {
    playMerge(maxMerge);
    if (prefs.haptics && maxMerge >= 128 && 'vibrate' in navigator) navigator.vibrate(10);
  }

  updateScore();
  if (state.score > best) {
    best = state.score;
    beatBestThisRun = true;
    setBest(best);
    updateBest(true);
  }

  renderer.render(state, prev, effects);
  announceMove(
    dir,
    effects.merged.length,
    state.score,
    state.maxTile,
    prefs.announce === 'verbose',
    effects.merged.map((m) => `+${formatNumber(m.value)}`),
  );

  if (firstWin && next.status === 'OVER') showEnd(true, true);
  else if (firstWin) showEnd(true, false);
  else if (next.status === 'OVER') showEnd(next.won, true);
  // game_end fires once per run, when it concludes (win runs end on OVER or
  // when the player starts a new game from the win screen).
  if (next.status === 'OVER') fireGameEnd(next.won ? 'win' : 'lose');
  persist();
  return true;
}

// ---------------------------------------------------------------------------
// End overlay (FR-07)

function fillEndStats(): void {
  endStats.textContent = '';
  const rows: Array<[string, string, boolean]> = [
    [t('score'), formatScore(state.score).text, state.won],
    [t('best'), formatScore(best).text, false],
    [t('maxTile'), String(state.maxTile), false],
    [t('moves'), String(state.moves), false],
    [t('time'), formatDuration(currentElapsed()), false],
  ];
  for (const [label, value, highlight] of rows) {
    const div = document.createElement('div');
    div.className = highlight ? 'end-stat win-stat' : 'end-stat';
    const l = document.createElement('div');
    l.className = 'stat-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = value;
    div.append(l, v);
    endStats.appendChild(div);
  }
}

function showEnd(won: boolean, over: boolean): void {
  endTitle.textContent = won ? t('win') : t('lose');
  if (won && over) endSub.textContent = t('winWinBoth');
  else if (won) endSub.textContent = t('winSub');
  else endSub.textContent = state.maxTile >= 1024 ? t('soClose', { tile: state.maxTile }) : t('loseSub');

  fillEndStats();
  keepGoingBtn.hidden = !(won && !over);
  tryAgainBtn.textContent = won ? t('newGame') : t('tryAgain');
  shareBtn.hidden = !(won || state.maxTile >= 512 || beatBestThisRun);

  openOverlay(endEl, {
    focus: won && !over ? keepGoingBtn : tryAgainBtn,
    closeOnEsc: false, // FR-07: Esc must not close the end overlay
  });
  if (won) announceWin(state.score, state.maxTile, currentElapsed());
  else announceLose(state.score, state.maxTile);
}

// ---------------------------------------------------------------------------
// Share (FR-09)

async function share(): Promise<void> {
  track('share_intent', { entry: state.won ? 'win' : 'lose' });
  const summary: ShareSummary = {
    score: state.score,
    maxTile: state.maxTile,
    elapsedMs: currentElapsed(),
    won: state.won,
  };
  const res = await shareScore(summary);
  track('share_result', { channel: res.channel, result: res.outcome });
  if (res.outcome === 'cancel') toast(t('shareCancelled'));
  else if (res.outcome === 'fail') toast(t('shareFailed'));
  else if (res.channel === 'copy') toast(t('shareCopied'));
  else if (res.channel === 'download') toast(t('shareDownloaded'));
  else announce(t('shareDone'));
}

// ---------------------------------------------------------------------------
// Board info dialog (FR-12: press I)

function openBoardInfo(): void {
  const tbody = boardInfoTable.querySelector('tbody')!;
  tbody.textContent = '';
  for (let r = 0; r < 4; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 4; c++) {
      const td = document.createElement('td');
      const tile = state.board[r * 4 + c];
      if (tile) {
        td.textContent = String(tile.value);
        td.setAttribute('aria-label', t('cellLabel', { r: r + 1, c: c + 1, value: tile.value }));
      } else {
        td.textContent = t('emptyCell');
        td.classList.add('empty');
      }
      td.tabIndex = 0;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  openOverlay(boardInfoEl, { focus: tbody.querySelector('td') ?? undefined });
}

// ---------------------------------------------------------------------------
// Settings (FR-11)

function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  prefs = { ...prefs, [key]: value };
  savePrefs(prefs);
  track('setting_change', { key, value: String(value) });
}

function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key as Parameters<typeof t>[0]);
  });
  if (!keepGoingBtn.hidden) keepGoingBtn.textContent = t('keepGoing');
  if (!tryAgainBtn.hidden) tryAgainBtn.textContent = state?.won ? t('newGame') : t('tryAgain');
}

function syncSettingsControls(): void {
  $<HTMLInputElement>('set-sound').checked = prefs.sound;
  $<HTMLInputElement>('set-haptics').checked = prefs.haptics;
  $<HTMLSelectElement>('set-motion').value = prefs.motion;
  $<HTMLInputElement>('set-shortcuts').checked = prefs.shortcuts;
  $<HTMLSelectElement>('set-announce').value = prefs.announce;
  $<HTMLSelectElement>('set-lang').value = prefs.lang;
  $<HTMLInputElement>('set-analytics').checked = prefs.analytics;
}

function openSettings(): void {
  syncSettingsControls();
  openOverlay(settingsEl, { focus: $('btn-close-settings') });
}

function genericConfirm(title: string, action: () => void): void {
  genericConfirmTitle.textContent = title;
  openOverlay(genericConfirmEl, {
    focus: $('btn-generic-cancel'),
    onClosed: () => {
      // action fires only via the confirm button; closing is a no-op
    },
  });
  const confirmBtn = $<HTMLButtonElement>('btn-generic-confirm');
  confirmBtn.onclick = () => {
    closeOverlay(genericConfirmEl);
    action();
  };
}

function exportMyData(): void {
  const json = exportData(prefs, best, state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '2048-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Multi-tab (FR-05 AC-04)

function enterReadOnly(): void {
  readOnly = true;
  readonlyEl.classList.remove('hidden');
}

function exitReadOnly(): void {
  readOnly = false;
  readonlyEl.classList.add('hidden');
}

function reloadStateFromStorage(): void {
  const load = loadGame();
  if (load.kind === 'restored') {
    state = load.state;
  } else {
    state = newGame(newSeed().seed);
  }
  baseElapsed = state.elapsedMs;
  timerRunning = false;
  renderer.clear();
  renderer.render(state, null, null);
  updateScore();
}

function takeover(): void {
  if (!acquireLease()) {
    toast(t('readOnlyBanner'));
    return;
  }
  reloadStateFromStorage();
  exitReadOnly();
  track('game_start', { mode: 'classic', resumed: true, source: 'takeover' });
}

// ---------------------------------------------------------------------------
// Error handling (FR-15)

let errorSeq = 0;
function showErrorBanner(code: string): void {
  currentErrorCode = code;
  errorEl.classList.remove('hidden');
}

function installErrorHandlers(): void {
  const report = () => {
    errorSeq += 1;
    const code = `2048-shell-${String(errorSeq).padStart(3, '0')}`;
    showErrorBanner(code);
    track('error', { code, module: 'shell', severity: 'error' });
  };
  window.addEventListener('error', report);
  window.addEventListener('unhandledrejection', report);
}

// ---------------------------------------------------------------------------
// Service worker (FR-14, prod only)

function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const warmCache = (reg: ServiceWorkerRegistration): void => {
    if (!reg.active) return;
    const urls = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((u) => u.startsWith(location.origin));
    reg.active.postMessage({ type: 'WARM_CACHE', urls });
  };

  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            updateEl.classList.remove('hidden');
            track('sw_update', { action: 'available' });
          }
        });
      });
    })
    .catch(() => {
      /* offline-first is a bonus; never fatal */
    });

  // The first page load is not intercepted (SW takes control after), and
  // controllerchange never fires without a previous controller — so warm the
  // cache as soon as an active worker exists, and again on later updates.
  void navigator.serviceWorker.ready.then(warmCache);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) warmCache(reg);
    });
  });
}

// ---------------------------------------------------------------------------
// Wiring

function wireButtons(): void {
  $('btn-new').addEventListener('click', restart);
  $('btn-settings').addEventListener('click', openSettings);
  keepGoingBtn.addEventListener('click', keepGoing);
  tryAgainBtn.addEventListener('click', restart);
  shareBtn.addEventListener('click', () => void share());
  $('btn-keep-playing').addEventListener('click', () => {
    closeOverlay(confirmEl);
    track('confirm_result', { result: 'cancel' });
  });
  $('btn-confirm-new').addEventListener('click', confirmNew);
  $('btn-close-settings').addEventListener('click', () => closeOverlay(settingsEl));
  $('btn-close-boardinfo').addEventListener('click', () => closeOverlay(boardInfoEl));
  $('btn-generic-cancel').addEventListener('click', () => closeOverlay(genericConfirmEl));
  $('btn-refresh').addEventListener('click', () => location.reload());
  $('btn-copy-error').addEventListener('click', () => {
    void navigator.clipboard.writeText(currentErrorCode).then(() => toast(t('errorCopied')));
  });
  $('btn-takeover').addEventListener('click', takeover);
  $('btn-update-refresh').addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      location.reload();
    });
  });

  $<HTMLInputElement>('set-sound').addEventListener('change', (e) => {
    setPref('sound', (e.target as HTMLInputElement).checked);
    setSoundEnabled(prefs.sound);
    if (prefs.sound) {
      unlockAudio();
      playMove(); // preview (FR-11)
    }
  });
  $<HTMLInputElement>('set-haptics').addEventListener('change', (e) => {
    setPref('haptics', (e.target as HTMLInputElement).checked);
    if (prefs.haptics && 'vibrate' in navigator) navigator.vibrate(10);
  });
  $<HTMLSelectElement>('set-motion').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value as Prefs['motion'];
    setPref('motion', v);
    document.documentElement.setAttribute('data-motion', v);
  });
  $<HTMLInputElement>('set-shortcuts').addEventListener('change', (e) => {
    setPref('shortcuts', (e.target as HTMLInputElement).checked);
  });
  $<HTMLSelectElement>('set-announce').addEventListener('change', (e) => {
    setPref('announce', (e.target as HTMLSelectElement).value as Prefs['announce']);
  });
  $<HTMLSelectElement>('set-lang').addEventListener('change', (e) => {
    const lang = (e.target as HTMLSelectElement).value as Prefs['lang'];
    setPref('lang', lang);
    setLang(lang);
    applyI18n();
  });
  $<HTMLInputElement>('set-analytics').addEventListener('change', (e) => {
    setPref('analytics', (e.target as HTMLInputElement).checked);
    setAnalyticsEnabled(prefs.analytics);
  });
  $('btn-reset-best').addEventListener('click', () =>
    genericConfirm(t('resetBestConfirm'), () => {
      resetBest();
      best = 0;
      updateBest();
    }),
  );
  $('btn-export-data').addEventListener('click', exportMyData);
  $('btn-delete-data').addEventListener('click', () =>
    genericConfirm(t('deleteDataConfirm'), () => {
      deleteAllData();
      location.reload();
    }),
  );
}

function onVisibility(): void {
  if (document.hidden) {
    pauseTimer();
    if (state) {
      state.elapsedMs = baseElapsed;
      persist();
    }
    flushSave();
    flushTelemetry();
  } else {
    resumeTimer();
  }
}

// ---------------------------------------------------------------------------
// Boot

function boot(): void {
  initAnnounce();
  prefs = loadPrefs();
  // No saved prefs: language follows the browser (FR-01/FR-13), the default
  // 'zh-CN' is only a fallback.
  if (store.get(KEY_PREFS) === null) {
    prefs.lang = detectLang(navigator.languages);
  }
  document.documentElement.setAttribute('data-motion', prefs.motion);
  setLang(prefs.lang);
  applyI18n();
  setSoundEnabled(prefs.sound);
  setAnalyticsEnabled(prefs.analytics);
  appVersionEl.textContent = APP_VERSION;
  settingsVersionEl.textContent = APP_VERSION;

  best = getBest();
  updateBest();

  initMultiTab({
    onBecomeFollower: enterReadOnly,
    onStateChangedExternally: () => {
      if (readOnly) {
        reloadStateFromStorage();
        renderer.render(state, null, null);
      }
    },
  }).start();

  const load = loadGame();
  if (load.kind === 'restored') {
    state = load.state;
    baseElapsed = state.elapsedMs;
    showRestoredNotice();
    track('game_start', { mode: 'classic', resumed: true, source: 'reload' });
  } else {
    state = newGame(newSeed().seed);
    if (load.notice === 'corrupt') toast(t('corruptNotice'));
    else if (load.notice === 'migrate') toast(t('migrateFailed'));
    track('game_start', { mode: 'classic', resumed: false, source: 'first_open' });
  }
  renderer.render(state, null, null);
  updateScore();
  resumeTimer();
  if (!prefs.introSeen) introEl.classList.remove('hidden');
  announceGameIntro(state.score, best);

  track('app_open', {
    lang: prefs.lang,
    lang_source: 'auto',
    display_mode: 'browser',
    device_class: deviceClass(),
    return_visit: true,
    app_version: APP_VERSION,
  });

  wireButtons();
  initInput({
    move,
    restart,
    escape: closeTop,
    info: openBoardInfo,
    isModalOpen,
    shortcutsEnabled: () => prefs.shortcuts,
  });

  window.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => {
    flushSave();
    flushTelemetry();
  });
  window.addEventListener('2048:save-failed', () => toast(t('saveFailed')));
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_GAME && readOnly) {
      reloadStateFromStorage();
      renderer.render(state, null, null);
    }
  });
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  installErrorHandlers();
  registerSW();
}

boot();
