export const RING_SEGMENTS = 64;
export const RING_REVEAL_DURATION_MS = 650;

const INDICES_PER_SEGMENT = 6;

export function getRingRevealDrawCount(
  startedAt: number,
  now: number,
  reducedMotion = false,
) {
  if (reducedMotion) {
    return RING_SEGMENTS * INDICES_PER_SEGMENT;
  }

  const progress = Math.min(
    1,
    Math.max(0, (now - startedAt) / RING_REVEAL_DURATION_MS),
  );

  return Math.floor(progress * RING_SEGMENTS) * INDICES_PER_SEGMENT;
}

export function isRingRevealComplete(startedAt: number, now: number) {
  return getRingRevealDrawCount(startedAt, now) === RING_SEGMENTS * INDICES_PER_SEGMENT;
}
