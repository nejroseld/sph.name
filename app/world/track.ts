// Scroll track: 7 chapters mapped onto progress 0..TRACK_END.
// Each chapter is static for local 0..HOLD, then blends into the next one until SETTLE.
// The last chapter blends into sleep between SLEEP_IN and SLEEP_OUT instead.
export const TRACK_END = 6.96;
export const LAST = 6;
export const HOLD = .55;
export const SETTLE = .98;
export const SLEEP_IN = .48;
export const SLEEP_OUT = .92;
const REST = .25;
const IDLE_MS = 140;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (k: number) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

export const restPoint = (chapter: number) => chapter > LAST ? TRACK_END : chapter + REST;
export const trackSpan = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
export const progressToScroll = (p: number) => trackSpan() * p / TRACK_END;
export const scrollToProgress = (y: number) => clamp(y / trackSpan() * TRACK_END, 0, TRACK_END);

// Where a half-finished transition should settle. `direction` is the sign of the last scroll delta;
// the transition completes in the direction of travel, or past the midpoint when unknown.
export function snapTarget(progress: number, direction: number): number | null {
  const i = Math.min(LAST, Math.floor(progress)), local = progress - i;
  if (i === LAST) {
    if (local <= SLEEP_IN || local >= SLEEP_OUT) return null;
    const forward = direction ? direction > 0 : local > (SLEEP_IN + SLEEP_OUT) / 2;
    return forward ? TRACK_END : restPoint(LAST);
  }
  if (local <= HOLD || local >= SETTLE) return null;
  const forward = direction ? direction > 0 : local > (HOLD + SETTLE) / 2;
  return restPoint(forward ? i + 1 : i);
}

// Once the user stops scrolling inside a transition, glide the page to the nearest resting point.
export function createAutoSnap(allowed: () => boolean) {
  let lastInput = performance.now(), lastY = scrollY, direction = 0, evaluated = false;
  let snapping = false, from = 0, to = 0, start = 0, duration = 0, expected = -1;
  const cancel = () => { snapping = false; expected = -1; };
  const input = () => { cancel(); lastInput = performance.now(); evaluated = false; };
  const onScroll = () => {
    const y = scrollY;
    if (snapping) { if (Math.abs(y - expected) > 2) input(); }
    else { if (y !== lastY) direction = Math.sign(y - lastY); lastInput = performance.now(); evaluated = false; }
    lastY = y;
  };
  const keys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const onKey = (e: KeyboardEvent) => { if (keys.has(e.key)) input(); };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("wheel", input, { passive: true });
  addEventListener("touchstart", input, { passive: true });
  addEventListener("touchmove", input, { passive: true });
  addEventListener("keydown", onKey);
  return {
    update(now: number) {
      if (snapping) {
        const k = Math.min(1, (now - start) / duration);
        expected = from + (to - from) * ease(k);
        scrollTo({ top: expected, behavior: "instant" });
        if (k >= 1) cancel();
        return;
      }
      if (evaluated || !allowed() || now - lastInput < IDLE_MS) return;
      evaluated = true;
      const progress = scrollToProgress(scrollY);
      const goal = snapTarget(progress, direction);
      if (goal === null) return;
      from = scrollY; to = progressToScroll(goal);
      if (Math.abs(to - from) < 1) return;
      start = now; duration = 550 + 900 * Math.min(1, Math.abs(goal - progress)); snapping = true;
    },
    cancel,
    destroy() {
      cancel();
      removeEventListener("scroll", onScroll); removeEventListener("wheel", input); removeEventListener("touchstart", input); removeEventListener("touchmove", input); removeEventListener("keydown", onKey);
    },
  };
}
