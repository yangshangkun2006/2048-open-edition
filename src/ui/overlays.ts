// Overlay manager: focus trap, Esc-to-close, focus restore (FR-02/FR-06/FR-12).

interface OpenOverlay {
  el: HTMLElement;
  trigger: HTMLElement | null;
  closeOnEsc: boolean;
}

const stack: OpenOverlay[] = [];

function focusables(el: HTMLElement): HTMLElement[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((n) => !n.hasAttribute('disabled') && n.offsetParent !== null);
}

function trapKeydown(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top || e.key !== 'Tab') return;
  const items = focusables(top.el);
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !top.el.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !top.el.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

let trapInstalled = false;

export function openOverlay(
  el: HTMLElement,
  opts: { focus?: HTMLElement; closeOnEsc?: boolean; onClosed?: () => void } = {},
): void {
  const trigger = document.activeElement as HTMLElement | null;
  el.classList.remove('hidden');
  (el as HTMLElement & { __onClosed?: () => void }).__onClosed = opts.onClosed;
  stack.push({ el, trigger, closeOnEsc: opts.closeOnEsc ?? true });
  if (!trapInstalled) {
    document.addEventListener('keydown', trapKeydown, true);
    trapInstalled = true;
  }
  (opts.focus ?? focusables(el)[0] ?? el.querySelector('button'))?.focus();
  if (el.id === 'overlay-end') el.classList.add('ready');
}

export function closeOverlay(el: HTMLElement): void {
  const idx = stack.findIndex((o) => o.el === el);
  if (idx === -1) return;
  const [entry] = stack.splice(idx, 1);
  el.classList.add('hidden');
  el.classList.remove('ready');
  entry?.trigger?.focus?.();
  const cb = (el as HTMLElement & { __onClosed?: () => void }).__onClosed;
  if (cb) {
    delete (el as HTMLElement & { __onClosed?: () => void }).__onClosed;
    cb();
  }
}

export function closeTop(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  if (top.closeOnEsc) closeOverlay(top.el);
  return top.closeOnEsc;
}

export function isModalOpen(): boolean {
  return stack.length > 0;
}

export function isEndOpen(): boolean {
  return stack.some((o) => o.el.id === 'overlay-end');
}
