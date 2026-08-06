import { useEffect, useRef, useState } from "react";

const STAGE1_TEXT = "Surveying the reviews…";
const STAGE2_TEXTS = [
  "Pulling in extra listings…",
  "Cross-checking additional sources…",
  "Filling in the gaps…",
  "Almost there…",
];
const DONE_TEXT = "Done — compiling results…";

const STAGE1_DURATION = 1800;
const STAGE1_TARGET = 55;
const STAGE2_DURATION = 7000;
const STAGE2_TARGET = 92;
const STAGE2_TEXT_INTERVAL = 1800;

// Simulated two-stage progress: the backend genuinely does try a fast direct
// fetch first and only falls back to the slower path on failure, but since
// /api/reviews is a single request/response (no streaming), the frontend
// can't know the real per-URL stage. This approximates it on a timeline
// that matches how the backend is actually paced.
export function useLoadingStages(active: boolean, complete: boolean) {
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState(STAGE1_TEXT);
  const frameRef = useRef<number>();
  const startRef = useRef(0);
  const stage2StartRef = useRef<number | null>(null);
  const textIndexRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      setText(STAGE1_TEXT);
      stage2StartRef.current = null;
      textIndexRef.current = 0;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    startRef.current = performance.now();
    stage2StartRef.current = null;
    textIndexRef.current = 0;

    function tick(now: number) {
      const elapsed = now - startRef.current;
      if (elapsed < STAGE1_DURATION) {
        setProgress((STAGE1_TARGET * elapsed) / STAGE1_DURATION);
        setText(STAGE1_TEXT);
      } else {
        if (stage2StartRef.current === null) {
          stage2StartRef.current = now;
          setText(STAGE2_TEXTS[0]);
        }
        const elapsed2 = now - stage2StartRef.current;
        const p =
          STAGE1_TARGET +
          Math.min(1, elapsed2 / STAGE2_DURATION) * (STAGE2_TARGET - STAGE1_TARGET);
        setProgress(p);

        const idx = Math.min(STAGE2_TEXTS.length - 1, Math.floor(elapsed2 / STAGE2_TEXT_INTERVAL));
        if (idx !== textIndexRef.current) {
          textIndexRef.current = idx;
          setText(STAGE2_TEXTS[idx]);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  if (complete) {
    return { progress: 100, text: DONE_TEXT };
  }
  return { progress, text };
}
