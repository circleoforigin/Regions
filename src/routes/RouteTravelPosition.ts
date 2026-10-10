import type {
  RouteLegProfile,
  RouteTraversalPoint,
} from '../models/Route';
import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export interface ResolvedRouteTravelPosition
{
  mapId: string;
  position: SpatialPoint;
}

export function resolveRouteTravelPosition(
  profile: RouteLegProfile,
  distanceFromLegStart: number
): ResolvedRouteTravelPosition
{
  if (profile.points.length === 0)
  {
    throw new Error(
      `Route Leg "${profile.legId}" has no traversal points.`
    );
  }

  const distance =
    Math.max(
      0,
      Math.min(
        profile.distance.value,
        distanceFromLegStart
      )
    );

  const firstPoint =
    profile.points[0];

  if (
    distance <=
    firstPoint.distanceFromLegStart.value
  )
  {
    return resolvePoint(firstPoint);
  }

  for (
    let index = 1;
    index < profile.points.length;
    index += 1
  )
  {
    const previous =
      profile.points[index - 1];

    const current =
      profile.points[index];

    const previousDistance =
      previous.distanceFromLegStart.value;

    const currentDistance =
      current.distanceFromLegStart.value;

    if (distance > currentDistance)
    {
      continue;
    }

    if (
      previous.mapId !== current.mapId
    )
    {
      throw new Error(
        `Route Leg "${profile.legId}" crosses Maps.`
      );
    }

    const segmentDistance =
      currentDistance -
      previousDistance;

    if (segmentDistance <= 0)
    {
      return resolvePoint(current);
    }

    const progress =
      Math.max(
        0,
        Math.min(
          1,
          (
            distance -
            previousDistance
          ) / segmentDistance
        )
      );

    return {
      mapId: current.mapId,

      position: {
        x:
          previous.position.x +
          (
            current.position.x -
            previous.position.x
          ) *
          progress,

        y:
          previous.position.y +
          (
            current.position.y -
            previous.position.y
          ) *
          progress,
      },
    };
  }

  return resolvePoint(
    profile.points[
      profile.points.length - 1
    ]
  );
}

function resolvePoint(
  point: RouteTraversalPoint
): ResolvedRouteTravelPosition
{
  return {
    mapId: point.mapId,

    position: {
      ...point.position,
    },
  };
}