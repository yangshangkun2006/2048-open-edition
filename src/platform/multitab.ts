import { KEY_LEASE, store } from './storage';

// Multi-tab coordination per PRD §11.4: single writer via lease + monotonically
// increasing fencing token; followers are read-only with a takeover button.
// BroadcastChannel is used when available; otherwise heartbeat via storage
// events (worst case: warning, PRD §9.2).

const CHANNEL = '2048';
const LEASE_MS = 6_000;
const HEARTBEAT_MS = 2_000;

interface Lease {
  leaderId: string;
  leaseUntil: number;
  fencingToken: number;
}

export type TabRole = 'leader' | 'follower';

const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);

let channel: BroadcastChannel | null = null;
if (typeof BroadcastChannel !== 'undefined') {
  channel = new BroadcastChannel(CHANNEL);
}

function readLease(): Lease | null {
  const raw = store.get(KEY_LEASE);
  if (raw === null) return null;
  try {
    const l = JSON.parse(raw) as Lease;
    if (
      l &&
      typeof l.leaderId === 'string' &&
      typeof l.leaseUntil === 'number' &&
      typeof l.fencingToken === 'number'
    ) {
      return l;
    }
  } catch {
    /* invalid lease: treat as absent */
  }
  return null;
}

function writeLease(lease: Lease): void {
  store.set(KEY_LEASE, JSON.stringify(lease));
}

export function acquireLease(): boolean {
  const now = Date.now();
  const current = readLease();
  if (current && current.leaseUntil > now && current.leaderId !== tabId) {
    return false; // another tab holds a valid lease
  }
  const token = (current?.fencingToken ?? 0) + 1;
  writeLease({ leaderId: tabId, leaseUntil: now + LEASE_MS, fencingToken: token });
  return true;
}

export function isLeader(): boolean {
  const l = readLease();
  return l !== null && l.leaderId === tabId && l.leaseUntil > Date.now();
}

/** Extend our own lease; call on a heartbeat cadence. */
function renewLease(): void {
  const l = readLease();
  if (l && l.leaderId === tabId) {
    writeLease({ ...l, leaseUntil: Date.now() + LEASE_MS });
  }
}

export interface MultiTabCallbacks {
  onBecomeFollower: () => void;
  onStateChangedExternally: () => void;
}

export function initMultiTab(cb: MultiTabCallbacks): { role: TabRole; start: () => void } {
  let role: TabRole = 'leader';

  const becomeFollower = () => {
    if (role === 'follower') return;
    role = 'follower';
    cb.onBecomeFollower();
  };

  const becomeLeader = () => {
    if (role === 'leader') return;
    role = 'leader';
  };

  const sync = () => {
    const l = readLease();
    const alive = l !== null && l.leaseUntil > Date.now();
    if (!alive) {
      // Lease expired (leader tab closed or crashed): take over.
      if (acquireLease()) becomeLeader();
    } else if (l!.leaderId !== tabId) {
      becomeFollower();
    } else {
      becomeLeader();
    }
  };

  if (channel) {
    channel.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; tabId?: string } | null;
      if (msg && typeof msg === 'object' && msg.tabId !== tabId) {
        sync();
        if (msg.type === 'heartbeat' && isLeader()) {
          // Reply so a fresh tab learns the current leader promptly.
          channel?.postMessage({ type: 'heartbeat', tabId });
        }
      }
    };
  } else {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY_LEASE || e.key === null) sync();
    });
  }

  const start = () => {
    const l = readLease();
    const alive = l !== null && l.leaseUntil > Date.now();
    if (!alive) {
      acquireLease();
      role = 'leader';
    } else if (l!.leaderId !== tabId) {
      role = 'follower';
    } else {
      role = 'leader';
    }
    setInterval(() => {
      if (isLeader()) renewLease();
      else sync();
      if (channel) channel.postMessage({ type: 'heartbeat', tabId });
    }, HEARTBEAT_MS);
  };

  return { role, start };
}

/** Call before every save: returns false when another tab took over. */
export function canWrite(): boolean {
  return isLeader();
}
