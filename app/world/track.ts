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
// Touch paging: the finger is ignored until it has moved DEADZONE px, then a swipe of DRAG viewport heights carries
// the scene all the way to the neighbouring resting point; on release it commits past COMMIT viewport heights
// or above FLICK px/ms, otherwise it springs back.
// Mobile Safari's engine (every browser on iOS and iPadOS) feels sluggish with the general values, so it gets livelier ones.
const WEBKIT_MOBILE = typeof navigator !== "undefined"
  && (/iP(hone|od|ad)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
const [DEADZONE, DRAG, COMMIT, FLICK] = WEBKIT_MOBILE ? [8, .45, .08, .3] : [14, .8, .2, .6];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// Quintic "smootherstep": zero velocity and zero acceleration at both ends, so the glide neither jolts nor stops dead.
const ease = (k: number) => k * k * k * (k * (k * 6 - 15) + 10);

export const restPoint = (chapter: number) => chapter > LAST ? TRACK_END : chapter + REST;
// Every place a swipe can land: in bed, each chapter's resting point, asleep.
const RESTS = [0, ...Array.from({ length: LAST + 1 }, (_, i) => restPoint(i)), TRACK_END];
const isRest = (p: number) => RESTS.some(r => Math.abs(r - p) < 1e-3);
const restBelow = (p: number) => [...RESTS].reverse().find(r => r < p - 1e-3) ?? p;
const restAbove = (p: number) => RESTS.find(r => r > p + 1e-3) ?? p;
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
//  - On touch screens the page never scrolls natively (no momentum, no browser toolbar resizing the track mid-gesture):
//    a swipe drags the scene towards the neighbouring resting point and, on release, completes the step or springs back.
//    `touchable()` says whether swipes may move the scene right now; touches inside an open panel are always left alone.
export function createAutoSnap(allowed: () => boolean, limited: () => boolean, touchable: () => boolean) {
  let lastInput = performance.now(), lastY = scrollY, direction = 0, evaluated = false, lastEval = 0;
  let snapping = false, from = 0, to = 0, goal = 0, start = 0, duration = 0, expected = -1, expectedPrev = -1;
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
  // The swipe in progress: where it started, the two resting points it may reach, and recent finger positions for the flick speed.
  // `queued` is where an interrupted glide was heading, so a swipe in the same direction steps on from there.
  let swipe: { y0: number; p0: number; prev: number; next: number; queued: number | null; samples: [number, number][] } | null = null;
  const inPanel = (e: TouchEvent) => !!(e.target as Element | null)?.closest?.('[data-slot="sheet-content"]');
  const place = (p: number) => { const y = progressToScroll(p); scrollTo({ top: y, behavior: "instant" }); lastY = scrollY; };
  const onTouchStart = (e: TouchEvent) => {
    swipe = null;
    if (e.touches.length !== 1 || inPanel(e) || !touchable()) return;
    const queued = snapping ? goal : null;
    if (snapping) cancel();
    const p0 = visual; place(p0);
    const prev = restBelow(p0), next = restAbove(p0);
    gesture = true; lo = prev; hi = next; userUntil = performance.now() + 600; touch();
    const y = e.touches[0].clientY;
    swipe = { y0: y, p0, prev, next, queued, samples: [[performance.now(), y]] };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (inPanel(e) || e.touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
    if (!swipe) return;
    const now = performance.now(), y = e.touches[0].clientY, dy = swipe.y0 - y;
    const k = Math.min(1, Math.max(0, Math.abs(dy) - DEADZONE) / (innerHeight * DRAG));
    swipe.samples.push([now, y]); while (swipe.samples.length > 2 && now - swipe.samples[0][0] > 100) swipe.samples.shift();
    if (dy) direction = Math.sign(dy);
    place(dy > 0 ? swipe.p0 + (swipe.next - swipe.p0) * k : swipe.p0 - (swipe.p0 - swipe.prev) * k);
    userUntil = now + 600; touch();
  };
  const onTouchEnd = () => {
    if (!swipe) return;
    const { y0, p0, prev, next, queued, samples } = swipe; swipe = null;
    const [t0, ya] = samples[0], [t1, yb] = samples[samples.length - 1];
    const speed = t1 > t0 ? (ya - yb) / (t1 - t0) : 0, dy = y0 - yb;
    const dir = Math.abs(dy) < DEADZONE ? 0 : Math.abs(speed) > FLICK ? Math.sign(speed) : Math.abs(dy) > innerHeight * COMMIT ? Math.sign(dy) : 0;
    let target = dir > 0 ? next : dir < 0 ? prev : isRest(p0) ? p0 : p0 - prev < next - p0 ? prev : next;
    // Swiping on in the direction a glide was already going adds one more step instead of repeating the same one.
    if (dir && queued !== null && Math.sign(queued - p0) === dir) target = dir > 0 ? restAbove(queued) : restBelow(queued);
    direction = dir; touch();
    if (!limited()) { place(target); endGesture(); return; }
    lo = Math.min(lo, target); hi = Math.max(hi, target);
    if (!glide(target, performance.now(), WEBKIT_MOBILE)) endGesture();
  };
  // The browser chrome or a rotation changed the track's length: keep the scene where it is.
  const onResize = () => { if (!swipe && !snapping) place(visual); };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("wheel", onWheel, { passive: true });
  addEventListener("touchstart", onTouchStart, { passive: true });
  addEventListener("touchmove", onTouchMove, { passive: false });
  addEventListener("touchend", onTouchEnd);
  addEventListener("touchcancel", onTouchEnd);
  addEventListener("resize", onResize);
  addEventListener("keydown", onKey);
  // `quick` finishes a released swipe on mobile Safari: the finger has already done part of the work, so the rest should not drag on.
  const glide = (p: number, now: number, quick = false) => {
    from = scrollY; to = progressToScroll(p); goal = p;
    if (Math.abs(to - from) < 1) return false;
    const dist = Math.min(1.6, Math.abs(goal - scrollToProgress(from)));
    start = now; duration = quick ? 380 + 520 * dist : 650 + 900 * dist;
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
        // A frame's timestamp can predate a glide started by an event in the same frame: never run it backwards.
        const k = clamp((now - start) / duration, 0, 1);
        expectedPrev = expected; expected = from + (to - from) * ease(k);
        scrollTo({ top: expected, behavior: "instant" });
        if (k >= 1) { cancel(); endGesture(); }
        return;
      }
      if (swipe || !allowed() || now - lastInput < IDLE_MS) return;
      // Re-check every so often while idle, so a missed evaluation can never leave a transition half-done.
      if (evaluated && now - lastEval < 400) return;
      evaluated = true; lastEval = now;
      const p = scrollToProgress(scrollY);
      const settle = clamp(snapTarget(p, direction) ?? p, bounded() ? lo : 0, bounded() ? hi : TRACK_END);
      if (Math.abs(settle - p) < 1e-3 || !glide(settle, now)) endGesture();
    },
    // Chapter navigation: glide the page there, letting the scene travel through the chapters in between.
    goTo(p: number) {
      cancel(); gesture = true; lo = Math.min(visual, p); hi = Math.max(visual, p);
      if (!glide(p, performance.now())) endGesture();
    },
    // The scene has repositioned itself (restart, end-of-day loop): forget the gesture and adopt the new position.
    jump(p: number) { cancel(); endGesture(); swipe = null; visual = p; lastY = progressToScroll(p); direction = 0; evaluated = false; },
    cancel,
    destroy() {
      cancel();
      removeEventListener("scroll", onScroll); removeEventListener("wheel", onWheel); removeEventListener("touchstart", onTouchStart); removeEventListener("touchmove", onTouchMove); removeEventListener("touchend", onTouchEnd); removeEventListener("touchcancel", onTouchEnd); removeEventListener("resize", onResize); removeEventListener("keydown", onKey);
    },
  };
}
