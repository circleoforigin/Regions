import type {
  Route,
  RouteLeg,
  RouteLegProfile,
  RouteNode,
  RouteTraversalPoint,
} from '../models/Route';
import type { SpatialPoint } from '../spatial/SpatialAnchor';

export function advanceRouteToPosition(
  route: Route,
  routeLeg: RouteLeg,
  profile: RouteLegProfile,
  distanceFromLegStart: number,
  position: SpatialPoint
): Route
{
  const distance =
    Math.max(
      0,
      Math.min(
        profile.distance.value,
        distanceFromLegStart
      )
    );

  if (distance >= profile.distance.value)
  {
    return advanceToLegEnd(
      route,
      routeLeg
    );
  }

  if (distance <= 0)
  {
    return route;
  }

  const currentNode: RouteNode = {
    id:
      `travel:${route.id}:` +
      `${routeLeg.id}:${distance}`,
    mapId: routeLeg.start.mapId,
    kind: 'point',
    position: {
      ...position,
    },
  };

  const remainingPoints =
    createRemainingPoints(
      profile,
      distance,
      position
    );

  const remainingProfile: RouteLegProfile = {
    ...profile,
    legId:
      `${currentNode.id}:${routeLeg.end.id}`,
    distance: {
      ...profile.distance,
      value:
        Math.max(
          0,
          profile.distance.value -
            distance
        ),
    },
    points: remainingPoints,
  };

  const remainingNodes = [
    currentNode,
    ...route.nodes.slice(
      routeLeg.index + 1
    ),
  ];

  const remainingProfiles =
    route.legProfiles
      ?.filter(
        (candidate) =>
          candidate.legId !==
          profile.legId
      )
      .filter(
        (candidate) =>
          remainingNodes.some(
            (node, index) =>
              index <
                remainingNodes.length - 1 &&
              `${node.id}:` +
                `${remainingNodes[index + 1].id}` ===
                candidate.legId
          )
      ) ??
    [];

  return {
    ...route,
    nodes: remainingNodes,
    legProfiles: [
      remainingProfile,
      ...remainingProfiles,
    ],
    updatedAt: new Date(),
  };
}

function advanceToLegEnd(
  route: Route,
  routeLeg: RouteLeg
): Route
{
  return {
    ...route,
    nodes:
      route.nodes.slice(
        routeLeg.index + 1
      ),
    legProfiles:
      route.legProfiles?.filter(
        (profile) =>
          profile.legId !==
          routeLeg.id
      ),
    updatedAt: new Date(),
  };
}

function createRemainingPoints(
  profile: RouteLegProfile,
  distance: number,
  position: SpatialPoint
): RouteTraversalPoint[]
{
  const firstRemaining =
    profile.points.find(
      (point) =>
        point.distanceFromLegStart.value >
        distance
    );

  const mapId =
    firstRemaining?.mapId ??
    profile.points[
      profile.points.length - 1
    ].mapId;

  const currentPoint: RouteTraversalPoint = {
    mapId,
    position: {
      ...position,
    },
    distanceFromLegStart: {
      ...profile.distance,
      value: 0,
    },
  };

  const laterPoints =
    profile.points
      .filter(
        (point) =>
          point.distanceFromLegStart.value >
          distance
      )
      .map(
        (point) => ({
          ...point,
          position: {
            ...point.position,
          },
          distanceFromLegStart: {
            ...point.distanceFromLegStart,
            value:
              point.distanceFromLegStart.value -
              distance,
          },
        })
      );

  return [
    currentPoint,
    ...laterPoints,
  ];
}