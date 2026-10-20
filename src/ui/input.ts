import type { Dir } from '../core';

// FR-02 input system: keyboard (arrows / WASD / HJKL / R / Esc / I), touch
// gestures (>10px, single finger, board area only), with a 100ms auto-repeat
// throttle (invalid moves do not consume the window).

export interface InputHooks {
  /** Returns true when the move was accepted (valid). */
  move(dir: Dir, source: 'keyboard' | 'touch'): boolean;
  restart(): void;
  escape(): void;
  info(): void;
  /** True when a dialog/overlay is open (only Esc handled globally). */
  isModalOpen(): boolean;
  /** True when shortcuts are disabled in prefs. */
  shortcutsEnabled(): boolean;
}

const REPEAT_MS = 100;

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function initInput(hooks: InputHooks): void {
  let lastAccepted = 0;

  const handleDir = (dir: Dir, isRepeat: boolean): void => {
    const now = performance.now();
    if (isRepeat && now - lastAccepted < REPEAT_MS) return;
    if (hooks.move(dir, 'keyboard')) lastAccepted = now;
  };

  window.addEventListener('keydown', (e) => {
    if (hooks.isModalOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        hooks.escape();
      }
      return;
    }
    // Modifier combos keep browser shortcuts (FR-02); Shift+letter stays
    // available for uppercase WASD.
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const k = e.key;
    if (k in KEY_DIRS) {
      if (e.shiftKey) return;
      e.preventDefault();
      handleDir(KEY_DIRS[k]!, e.repeat);
      return;
    }

    const lower = k.toLowerCase();
    const letterDirs: Record<string, Dir> = {
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
      k: 'up',
      h: 'left',
      j: 'down',
      l: 'right',
    };
    if (lower in letterDirs) {
      e.preventDefault();
      handleDir(letterDirs[lower]!, e.repeat);
      return;
    }

    if (hooks.shortcutsEnabled()) {
      if (k === 'r' || k === 'R') {
        e.preventDefault();
        hooks.restart();
      } else if (k === 'i' || k === 'I') {
        e.preventDefault();
        hooks.info();
      }
    }
  });

  // Touch: single finger, start inside the board, >10px displacement,
  // equal diagonals resolve vertically (FR-02 / PRD §6.8).
  const board = document.querySelector<HTMLElement>('#board');
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let multi = false;

  board?.addEventListener(
    'touchstart',
    (e) => {
      if (hooks.isModalOpen()) return;
      if (e.touches.length !== 1) {
        multi = true;
        tracking = false;
        return;
      }
      multi = false;
      tracking = true;
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
    },
    { passive: true },
  );

  board?.addEventListener(
    'touchend',
    (e) => {
      if (!tracking || multi || hooks.isModalOpen()) {
        tracking = false;
        return;
      }
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (Math.max(adx, ady) <= 10) return;
      const dir: Dir =
        ady >= adx
          ? dy < 0
            ? 'up'
            : 'down'
          : dx < 0
            ? 'left'
            : 'right';
      hooks.move(dir, 'touch');
    },
    { passive: true },
  );
}
