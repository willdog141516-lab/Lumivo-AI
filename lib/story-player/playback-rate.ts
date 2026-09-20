export const STORY_PLAYBACK_RATE = 0.5;
export const ROUTE_LINE_PLAYBACK_RATE = 1;

export const toTimelineDelta = (realDeltaMs: number) =>
  realDeltaMs * STORY_PLAYBACK_RATE;

export const toRealPlaybackDuration = (timelineDurationMs: number) =>
  Math.max(1, timelineDurationMs / STORY_PLAYBACK_RATE);

export const toRealRouteDuration = (timelineDurationMs: number) =>
  Math.max(
    1,
    timelineDurationMs / (STORY_PLAYBACK_RATE * ROUTE_LINE_PLAYBACK_RATE),
  );
