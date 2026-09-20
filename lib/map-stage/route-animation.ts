import type { GeoPoint } from "../trip/types.ts";

export type RouteAnimationEasing = "linear" | "easeInOut";

export type RouteAnimationPhase = {
  startedAt: number;
  durationMs: number;
  easing: RouteAnimationEasing;
};

export type RouteSample = {
  point: GeoPoint;
  segmentIndex: number;
  segmentProgress: number;
};

export function getRouteAnimationProgress(
  phase: RouteAnimationPhase,
  now: number,
  reducedMotion = false,
) {
  if (reducedMotion) {
    return 1;
  }

  const linearProgress = Math.min(
    1,
    Math.max(0, (now - phase.startedAt) / Math.max(1, phase.durationMs)),
  );

  return phase.easing === "easeInOut"
    ? linearProgress * linearProgress * (3 - 2 * linearProgress)
    : linearProgress;
}

export function createRouteSampler(points: readonly GeoPoint[]) {
  // ponytail: flat BD-09 distance is enough for short city routes; use projected meters for long-distance pacing.
  const cumulativeLengths = [0];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentLength = Math.hypot(
      current.lng - previous.lng,
      current.lat - previous.lat,
    );

    cumulativeLengths.push(cumulativeLengths[index - 1] + segmentLength);
  }

  const totalLength = cumulativeLengths.at(-1) ?? 0;

  return (progress: number): RouteSample | null => {
    if (points.length === 0) {
      return null;
    }

    if (points.length === 1 || totalLength === 0) {
      return {
        point: points[0],
        segmentIndex: 0,
        segmentProgress: 0,
      };
    }

    const normalizedProgress = Math.min(1, Math.max(0, progress));

    if (normalizedProgress === 1) {
      return {
        point: points[points.length - 1],
        segmentIndex: points.length - 2,
        segmentProgress: 1,
      };
    }

    const targetLength = totalLength * normalizedProgress;

    for (let index = 1; index < cumulativeLengths.length; index += 1) {
      if (targetLength <= cumulativeLengths[index]) {
        const previous = points[index - 1];
        const current = points[index];
        const segmentLength = cumulativeLengths[index] - cumulativeLengths[index - 1];
        const segmentProgress = segmentLength === 0
          ? 0
          : (targetLength - cumulativeLengths[index - 1]) / segmentLength;

        return {
          point: {
            lng: previous.lng + (current.lng - previous.lng) * segmentProgress,
            lat: previous.lat + (current.lat - previous.lat) * segmentProgress,
            crs: previous.crs,
          },
          segmentIndex: index - 1,
          segmentProgress,
        };
      }
    }

    return {
      point: points[points.length - 1],
      segmentIndex: points.length - 2,
      segmentProgress: 1,
    };
  };
}
