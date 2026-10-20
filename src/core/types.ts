// Core types per PRD §11.3.
export type Dir = 'up' | 'down' | 'left' | 'right';

export type Status = 'PLAYING' | 'WON' | 'POST_WIN' | 'OVER';

export interface Tile {
  id: number;
  value: number;
  c: number;
  r: number;
}

export interface GameState {
  schemaVersion: 2;
  /** Length 16, index = r * 4 + c. */
  board: (Tile | null)[];
  score: number;
  status: Status;
  won: boolean;
  moves: number;
  maxTile: number;
  seed: number;
  rngState: number;
  /** Foreground play time only, in ms. */
  elapsedMs: number;
  /** Timestamp of the first valid move; 0 before that. */
  startedAt: number;
  updatedAt: number;
}

export interface Rng {
  rngState: number;
}
