// Scroll track: 7 chapters mapped onto progress 0..TRACK_END.
// Each chapter is static for local 0..HOLD, then blends into the next one until SETTLE.
// The caption leaves during the FADE window before HOLD and returns during the FADE window after SETTLE.
// The last chapter blends into sleep between SLEEP_IN and SLEEP_OUT instead, then loops back to the first.
export const TRACK_END = 6.96;
export const LAST = 6;
export const HOLD = .55;
export const SETTLE = .98;
export const FADE = .14;
export const SLEEP_IN = .48;
export const SLEEP_OUT = .92;
const REST = .25;
// The first chapter is driven by scroll too: he lies in bed until WAKE_IN, is on his feet by WAKE_OUT
// (the chapter's resting point) and stretches until the caption starts to leave (HOLD - FADE).
export const WAKE_IN = .02;
export const WAKE_OUT = REST;
export const STRETCH_OUT = HOLD - FADE;
const IDLE_MS = 120;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// Quintic "smootherstep": zero velocity and zero acceleration at both ends, so the glide neither jolts nor stops dead.
const ease = (k: number) => k * k * k * (k * (k * 6 - 15) + 10);

export const restPoint = (chapter: number) => chapter > LAST ? TRACK_END : chapter + REST;
export const trackSpan = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
export const progressToScroll = (p: number) => trackSpan() * p / TRACK_END;
export const scrollToProgress = (y: number) => clamp(y / trackSpan() * TRACK_END, 0, TRACK_END);

// Where a half-finished transition should settle. `direction` is the sign of the last scroll delta;
// the transition completes in the direction of travel, or past the midpoint when unknown.
export function snapTarget(progress: number, direction: number): number | null {
  const i = Math.min(LAST, Math.floor(progress)), local = progress - i;
  // Tail of the previous transition: the caption is still fading in.
  if (i > 0 && local < SETTLE + FADE - 1) return restPoint(direction < 0 ? i - 1 : i);
  if (i === LAST) {
    // Same entry threshold as every other chapter; completing forward puts him to sleep, which starts the loop.
    if (local <= HOLD - FADE || local >= SLEEP_OUT) return null;
    const forward = direction ? direction > 0 : local > (HOLD - FADE + SLEEP_OUT) / 2;
    return forward ? TRACK_END : restPoint(LAST);
  }
  if (local <= HOLD - FADE || local >= SETTLE) return null;
  const forward = direction ? direction > 0 : local > (HOLD - FADE + SETTLE) / 2;
  return restPoint(forward ? i + 1 : i);
}

// Turns raw scrolling into chapter moves.
//  - `target()` is what the scene should show: the scroll position, clamped so that one gesture
//    (from the first input until the page has settled) can move at most one chapter in either direction.
//    Any extra scroll is ignored, and the page is quietly glided back to what is on screen afterwards.
//  - Once the user stops inside a transition, `update()` glides the page to the nearest resting point.
export function createAutoSnap(allowed: () => boolean, limited: () => boolean) {
  let lastInput = performance.now(), lastY = scrollY, direction = 0, evaluated = false, lastEval = 0;
  let snapping = false, from = 0, to = 0, start = 0, duration = 0, expected = -1, expectedPrev = -1;
  let visual = scrollToProgress(scrollY), gesture = false, lo = 0, hi = TRACK_END;
  // When the user last drove the page, and until when a scroll may still be theirs (touch momentum runs long).
  let userUntil = 0;
  const chapterAt = (p: number) => clamp(Math.round(p - REST), 0, LAST);
  const beginGesture = () => {
    if (gesture) return;
    gesture = true; const origin = chapterAt(visual);
    lo = origin === 0 ? 0 : restPoint(origin - 1); hi = origin === LAST ? TRACK_END : restPoint(origin + 1);
  };
  const endGesture = () => { gesture = false; };
  const cancel = () => { snapping = false; expected = expectedPrev = -1; };
  const touch = () => { lastInput = performance.now(); evaluated = false; };
  // Explicit user input during a glide: stop it, re-align the page with what is on screen, start a fresh gesture.
  const input = (momentum = 600) => {
    userUntil = performance.now() + momentum;
    if (snapping) {
      cancel(); endGesture();
      const y = progressToScroll(visual);
      if (Math.abs(scrollY - y) > 1) { scrollTo({ top: y, behavior: "instant" }); lastY = y; }
    }
    touch();
  };
  const onScroll = () => {
    const y = scrollY;
    // Our own glide may be reported one frame late, so both the current and the previous written positions are ours.
    if (snapping) { if (Math.abs(y - expected) > 2 && Math.abs(y - expectedPrev) > 2) { cancel(); touch(); } }
    else if (performance.now() > userUntil && !gesture) {
      // Nobody is driving: a programmatic or restored scroll. Adopt it instead of treating it as a gesture.
      visual = scrollToProgress(y); direction = 0; touch();
    }
    else { beginGesture(); if (y !== lastY) direction = Math.sign(y - lastY); touch(); }
    lastY = y;
  };
  const keys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const onKey = (e: KeyboardEvent) => { if (keys.has(e.key)) input(); };
  const onWheel = () => input();
  const onTouch = () => input(3000);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("wheel", onWheel, { passive: true });
  addEventListener("touchstart", onTouch, { passive: true });
  addEventListener("touchmove", onTouch, { passive: true });
  addEventListener("keydown", onKey);
  const glide = (goal: number, now: number) => {
    from = scrollY; to = progressToScroll(goal);
    if (Math.abs(to - from) < 1) return false;
    start = now; duration = 650 + 900 * Math.min(1.6, Math.abs(goal - scrollToProgress(from)));
    expected = expectedPrev = from; snapping = true; return true;
  };
  const bounded = () => gesture && limited();
  return {
    target() {
      const p = scrollToProgress(scrollY);
      visual = bounded() ? clamp(p, lo, hi) : p;
      return visual;
    },
    update(now: number) {
      if (snapping) {
        const k = Math.min(1, (now - start) / duration);
        expectedPrev = expected; expected = from + (to - from) * ease(k);
        scrollTo({ top: expected, behavior: "instant" });
        if (k >= 1) { cancel(); endGesture(); }
        return;
      }
      if (!allowed() || now - lastInput < IDLE_MS) return;
      // Re-check every so often while idle, so a missed evaluation can never leave a transition half-done.
      if (evaluated && now - lastEval < 400) return;
      evaluated = true; lastEval = now;
      const p = scrollToProgress(scrollY);
      const goal = clamp(snapTarget(p, direction) ?? p, bounded() ? lo : 0, bounded() ? hi : TRACK_END);
      if (Math.abs(goal - p) < 1e-3 || !glide(goal, now)) endGesture();
    },
    // Chapter navigation: glide the page there, letting the scene travel through the chapters in between.
    goTo(p: number) {
      cancel(); gesture = true; lo = Math.min(visual, p); hi = Math.max(visual, p);
      if (!glide(p, performance.now())) endGesture();
    },
    // The scene has repositioned itself (restart, end-of-day loop): forget the gesture and adopt the new position.
    jump(p: number) { cancel(); endGesture(); visual = p; lastY = progressToScroll(p); direction = 0; evaluated = false; },
    cancel,
    destroy() {
      cancel();
      removeEventListener("scroll", onScroll); removeEventListener("wheel", onWheel); removeEventListener("touchstart", onTouch); removeEventListener("touchmove", onTouch); removeEventListener("keydown", onKey);
    },
  };
}
