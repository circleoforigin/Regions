import type { Project } from '../models/Project';
import type {
  RouteLeg,
  RouteLegProfile,
} from '../models/Route';
import { getRouteLegs } from '../models/Route';
import {
  movePartyAndMembers,
  type PieceDock,
} from '../models/Piece';
import {
  resolveRouteTravelPosition,
  type ResolvedRouteTravelPosition,
} from './RouteTravelPosition';
import { advanceRouteToPosition } from './RouteProgress';

export interface RouteTravelCommitResult
{
  project: Project;
  routeLeg: RouteLeg;
  legProfile: RouteLegProfile;
  resolved: ResolvedRouteTravelPosition;
  routeComplete: boolean;
  routeLegComplete: boolean;
  remainingRouteLegId?: string;
}

export function commitRouteTravelPosition(
  project: Project,
  pieceId: string,
  routeLegId: string,
  distanceFromLegStart: number
): RouteTravelCommitResult
{
  const route =
    project.routes.find(
      (candidate) =>
        candidate.pieceId === pieceId
    );

  if (!route)
  {
    throw new Error(
      `Piece "${pieceId}" has no Route.`
    );
  }

  const routeLeg =
    getRouteLegs(route).find(
      (candidate) =>
        candidate.id === routeLegId
    );

  if (!routeLeg)
  {
    throw new Error(
      `Route Leg "${routeLegId}" was not found.`
    );
  }

  const legProfile =
    route.legProfiles?.find(
      (candidate) =>
        candidate.legId ===
        routeLeg.id
    );

  if (!legProfile)
  {
    throw new Error(
      `Route Leg "${routeLeg.id}" has no compiled profile.`
    );
  }

  const resolved =
    resolveRouteTravelPosition(
      legProfile,
      distanceFromLegStart
    );

  const routeLegComplete =
    distanceFromLegStart >=
    legProfile.distance.value;

  let arrivalDock: PieceDock | undefined;

  if (routeLegComplete)
  {
    switch (routeLeg.end.kind)
    {
      case 'feature':
        arrivalDock = {
          kind: 'feature',
          featureId:
            routeLeg.end.featureId,
        };
        break;

      case 'terminal':
        arrivalDock = {
          kind: 'terminal',
          terminalId:
            routeLeg.end.terminalId,
        };
        break;
    }
  }

  const pieces =
    movePartyAndMembers(
      project.pieces,
      pieceId,
      resolved.mapId,
      resolved.position,
      undefined,
      arrivalDock
    );

  const advancedRoute =
    advanceRouteToPosition(
      route,
      routeLeg,
      legProfile,
      distanceFromLegStart,
      resolved.position
    );

  const remainingRouteLegId =
    getRouteLegs(
      advancedRoute
    )[0]?.id;

  const routes =
    advancedRoute.nodes.length > 1
      ? project.routes.map(
          (candidate) =>
            candidate.id === route.id
              ? advancedRoute
              : candidate
        )
      : project.routes.filter(
          (candidate) =>
            candidate.id !== route.id
        );

  const routeComplete =
    advancedRoute.nodes.length <= 1;

  return {
    project: {
      ...project,
      pieces,
      routes,
    },
    routeLeg,
    legProfile,
    resolved,
    routeComplete,
    routeLegComplete,
    remainingRouteLegId,
  };
}