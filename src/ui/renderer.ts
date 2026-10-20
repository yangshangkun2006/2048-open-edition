import type { GameState, Tile } from '../core';
import { SIZE } from '../core';
import { formatScore, t } from '../platform/i18n';

// PRD §11.5: tile nodes are reused by tile.id; only transforms and text are
// updated. Merged tiles pop, spawned tiles appear, removed nodes are dropped.

interface Geometry {
  pad: number;
  cell: number;
  gap: number;
}

function readGeometry(boardEl: HTMLElement): Geometry {
  const cs = getComputedStyle(boardEl);
  return {
    pad: parseFloat(cs.getPropertyValue('--pad')) || 10,
    cell: parseFloat(cs.getPropertyValue('--cell')) || 57.5,
    gap: parseFloat(cs.getPropertyValue('--gap')) || 10,
  };
}

export interface MoveEffects {
  merged: Array<{ id: number; value: number; c: number; r: number }>;
  spawned: Set<number>;
}

export function diffEffects(prev: GameState, next: GameState): MoveEffects {
  const merged: MoveEffects['merged'] = [];
  const spawned = new Set<number>();
  const prevById = new Map<number, Tile>();
  for (const t of prev.board) if (t) prevById.set(t.id, t);
  for (const t of next.board) {
    if (!t) continue;
    const p = prevById.get(t.id);
    if (!p) spawned.add(t.id);
    else if (p.value * 2 === t.value) merged.push(t);
  }
  return { merged, spawned };
}

export class Renderer {
  private tilesEl: HTMLElement;
  private rowsEl: HTMLElement;
  private additionsEl: HTMLElement;
  private tileEls = new Map<number, HTMLElement>();
  private geometry: Geometry;

  constructor(boardEl: HTMLElement) {
    this.tilesEl = boardEl.querySelector<HTMLElement>('#board-tiles')!;
    this.rowsEl = document.querySelector<HTMLElement>('#board-sr')!;
    this.additionsEl = document.querySelector<HTMLElement>('#score-additions')!;
    this.geometry = readGeometry(boardEl);
    window.addEventListener('resize', () => {
      this.geometry = readGeometry(boardEl);
      // Reflow all tiles with the new geometry.
      for (const [id, el] of this.tileEls) {
        const tile = this.currentTile(id);
        if (tile) this.placeTile(el, tile);
      }
    });
  }

  private currentTile(id: number): Tile | null {
    return this.lastState?.board.find((t) => t?.id === id) ?? null;
  }

  private lastState: GameState | null = null;

  private placeTile(el: HTMLElement, tile: Tile): void {
    const { pad, cell, gap } = this.geometry;
    el.style.transform = `translate(${pad + tile.c * (cell + gap)}px, ${pad + tile.r * (cell + gap)}px)`;
  }

  private tileClass(value: number): string {
    if (value > 2048) return 'tile-super';
    return `tile-${value}`;
  }

  /** Drop all tile nodes; used when starting a fresh run (ids restart at 1). */
  clear(): void {
    for (const el of this.tileEls.values()) el.remove();
    this.tileEls.clear();
    this.lastState = null;
  }

  render(state: GameState, prev: GameState | null, effects: MoveEffects | null): void {
    this.lastState = state;
    const live = new Set<number>();

    for (const tile of state.board) {
      if (!tile) continue;
      live.add(tile.id);
      let el = this.tileEls.get(tile.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        el.setAttribute('data-value', String(tile.value));
        this.tilesEl.appendChild(el);
        this.tileEls.set(tile.id, el);
      }
      el.textContent = String(tile.value);
      el.dataset.value = String(tile.value);
      el.dataset.c = String(tile.c);
      el.dataset.r = String(tile.r);
      el.className = `tile ${this.tileClass(tile.value)}`;
      this.placeTile(el, tile);

      if (prev === null || (effects && effects.spawned.has(tile.id))) {
        el.classList.add('tile-appear');
      } else if (effects && effects.merged.some((m) => m.id === tile.id)) {
        el.classList.add('tile-pop', 'merged');
        el.addEventListener('animationend', () => el.classList.remove('tile-pop', 'merged'), {
          once: true,
        });
      }
    }

    for (const [id, el] of this.tileEls) {
      if (!live.has(id)) {
        el.remove();
        this.tileEls.delete(id);
      }
    }

    this.renderRows(state);
    if (effects) this.renderScoreAdditions(effects);
  }

  /** Semantic 4×4 table for screen readers (FR-12): role=table on the board. */
  private renderRows(state: GameState): void {
    if (this.rowsEl.childElementCount === 0) {
      for (let r = 0; r < SIZE; r++) {
        const row = document.createElement('div');
        row.setAttribute('role', 'row');
        for (let c = 0; c < SIZE; c++) {
          const cell = document.createElement('div');
          cell.setAttribute('role', 'cell');
          cell.setAttribute('aria-rowindex', String(r + 1));
          cell.setAttribute('aria-colindex', String(c + 1));
          row.appendChild(cell);
        }
        this.rowsEl.appendChild(row);
      }
    }
    const cells = this.rowsEl.querySelectorAll<HTMLElement>('[role="cell"]');
    state.board.forEach((tile, i) => {
      const cell = cells[i];
      if (!cell) return;
      const r = Math.floor(i / SIZE) + 1;
      const c = (i % SIZE) + 1;
      cell.setAttribute(
        'aria-label',
        tile ? t('cellLabel', { r, c, value: tile.value }) : t('cellLabel', { r, c, value: t('emptyCell') }),
      );
    });
  }

  private renderScoreAdditions(effects: MoveEffects): void {
    for (const m of effects.merged) {
      const el = document.createElement('div');
      el.className = 'score-addition';
      el.textContent = `+${formatScore(m.value).text}`;
      const { pad, cell, gap } = this.geometry;
      el.style.left = `${pad + m.c * (cell + gap)}px`;
      el.style.top = `${pad + m.r * (cell + gap)}px`;
      el.style.minWidth = `${cell}px`;
      el.style.textAlign = 'center';
      this.additionsEl.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  }
}
