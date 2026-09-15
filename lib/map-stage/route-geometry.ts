import type { GeoPoint } from "@/lib/trip/types";

type ProjectCoordinate = (input: number[], output: number[]) => number[];

export function createProjectedRoutePositions(
  points: readonly GeoPoint[],
  project: ProjectCoordinate,
) {
  const positions = new Float32Array(points.length * 3);

  points.forEach((point, index) => {
    const projected = project([point.lng, point.lat, 0], [0, 0, 0]);
    positions.set(
      [projected[0], projected[1], projected[2] ?? 0],
      index * 3,
    );
  });

  return positions;
}
