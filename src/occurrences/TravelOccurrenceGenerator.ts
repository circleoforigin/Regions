import {
  OccurrenceReactions,
  type Occurrence,
} from '@settingforge/module-sdk';
import type {
  RouteLeg,
  RouteLegProfile,
  RouteTraversalPoint,
} from '../models/Route';
import { formatRegionsOccurrenceMessage } from './RegionsOccurrenceMessages';

export interface TravelOccurrenceContext
{
  pieceId: string;
  pieceName: string;
  endpointFeatureName?: string;
  routeLeg: RouteLeg;
  legProfile: RouteLegProfile;
  isRouteEnd: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  distanceFromLegStart: number;
}

function getPointSimulationTime(
  point: RouteTraversalPoint,
  context: TravelOccurrenceContext
): number
{
  const remainingDistance =
    Math.max(
      0,
      context.legProfile.distance.value -
        context.distanceFromLegStart
    );

  if (remainingDistance <= 0)
  {
    return context.startTime;
  }

  const distanceFromProspectStart =
    Math.max(
      0,
      point.distanceFromLegStart.value -
        context.distanceFromLegStart
    );

  const progress =
    Math.max(
      0,
      Math.min(
        1,
        distanceFromProspectStart /
          remainingDistance
      )
    );

  return (
    context.startTime +
    context.duration * progress
  );
}

function createTraversalOccurrence(
  point: RouteTraversalPoint,
  context: TravelOccurrenceContext
): Occurrence | null
{
  if (point.sectorCrossing)
  {
    return createTravelRecalculateOccurrence(
      point,
      context
    );
  }

  return null;
}

function createEndpointTransitionOccurrences(
  context: TravelOccurrenceContext
): Occurrence[]
{
  const endpoint =
    context.legProfile.endpoint;

  if (!endpoint)
  {
    return [];
  }

  const occurrences: Occurrence[] = [];

  const addOccurrence = (
    description: string
  ) =>
  {
    occurrences.push({
      id: crypto.randomUUID(),
      sourceModuleId: 'regions',
      simulationTime: context.endTime,
      pieceId: context.pieceId,
      entityId: null,
      sectorId: null,
      type: 'section',
      description,
      reaction: OccurrenceReactions.Notify,
    });
  };

  const leavingArea =
    endpoint.leavingAreaName;

  const enteringArea =
    endpoint.enteringAreaName;

  const leavingPath =
    endpoint.leavingPathName;

  const enteringPath =
    endpoint.enteringPathName;

  const pathExitArea =
    endpoint.pathExitAreaName;

  const encounteredPath =
    endpoint.encounteredPathName;

  const travelingPathId =
    context.legProfile.path?.id;

  const encounteredPathId =
    endpoint.encounteredPathId;

  const crossingPath =
    encounteredPath &&
    encounteredPathId !== travelingPathId &&
    !enteringPath
      ? encounteredPath
      : undefined;

  /*
   * Crossing a Path without traveling
   * along it is a Path encounter.
   */
  if (crossingPath)
  {
    addOccurrence(
      formatRegionsOccurrenceMessage(
        'pathEncounter',
        {
          piece: context.pieceName,
          path: crossingPath,
        }
      )
    );
  }

  /*
   * Path -> open Area is one meaningful
   * transition rather than separate Path
   * and Area Occurrences.
   */
  if (
    leavingPath &&
    !enteringPath &&
    pathExitArea
  )
  {
    addOccurrence(
      formatRegionsOccurrenceMessage(
        'pathExitToArea',
        {
          piece: context.pieceName,
          path: leavingPath,
          area: pathExitArea,
        }
      )
    );
  }
  else if (
    leavingPath &&
    !enteringPath
  )
  {
    addOccurrence(
      formatRegionsOccurrenceMessage(
        'pathExit',
        {
          piece: context.pieceName,
          path: leavingPath,
        }
      )
    );
  }
  else
  {
    if (
      leavingPath &&
      enteringPath
    )
    {
      addOccurrence(
        formatRegionsOccurrenceMessage(
          'pathTransition',
          {
            piece: context.pieceName,
            fromPath: leavingPath,
            toPath: enteringPath,
          }
        )
      );
    }
    else if (enteringPath)
    {
      addOccurrence(
        formatRegionsOccurrenceMessage(
          'pathEncounter',
          {
            piece: context.pieceName,
            path: enteringPath,
          }
        )
      );
    }
  }

  /*
   * A Path -> Area transition already
   * describes entering that Area.
   */
  const areaEntryAlreadyDescribed =
    Boolean(
      leavingPath &&
      !enteringPath &&
      pathExitArea &&
      enteringArea
    );

  if (!areaEntryAlreadyDescribed)
  {
    if (
      leavingArea &&
      enteringArea
    )
    {
      addOccurrence(
        formatRegionsOccurrenceMessage(
          'areaTransition',
          {
            piece: context.pieceName,
            fromArea: leavingArea,
            toArea: enteringArea,
          }
        )
      );
    }
    else if (enteringArea)
    {
      addOccurrence(
        formatRegionsOccurrenceMessage(
          'areaEnter',
          {
            piece: context.pieceName,
            area: enteringArea,
          }
        )
      );
    }
    else if (leavingArea)
    {
      addOccurrence(
        formatRegionsOccurrenceMessage(
          'areaExit',
          {
            piece: context.pieceName,
            area: leavingArea,
          }
        )
      );
    }
  }

  return occurrences;
}

export function generateTravelOccurrences(
  context: TravelOccurrenceContext
): Occurrence[]
{
  const occurrences: Occurrence[] = [];

  for (const point of context.legProfile.points)
  {
    if (
      point.distanceFromLegStart.value <=
        context.distanceFromLegStart
    )
    {
      continue;
    }

    const occurrence =
      createTraversalOccurrence(
        point,
        context
      );

    if (!occurrence)
    {
      continue;
    }

    occurrences.push(occurrence);

    if (
      occurrence.reaction ===
        OccurrenceReactions.Recalculate
    )
    {
      return occurrences;
    }
  }

  /*
   * A Feature arrival is the first
   * meaningful event at its endpoint.
   *
   * Any Path or Area transition at that
   * same position describes what happens
   * after reaching the Feature.
   */
  if (
    context.legProfile.endpoint?.featureId &&
    context.endpointFeatureName
  )
  {
    occurrences.push({
      id: crypto.randomUUID(),
      sourceModuleId: 'regions',
      simulationTime: context.endTime,
      pieceId: context.pieceId,
      entityId: null,
      sectorId: null,
      type: 'location',
      displayLabel:
        context.isRouteEnd
          ? 'F'
          : undefined,
      description:
        formatRegionsOccurrenceMessage(
          'locationArrival',
          {
            piece: context.pieceName,
            location:
              context.endpointFeatureName,
          }
        ),
      reaction: OccurrenceReactions.Notify,
    });
  }

  occurrences.push(
    ...createEndpointTransitionOccurrences(
      context
    )
  );

    const boundaryLocationName =
    context.legProfile.endpoint
      ?.boundaryLocationName;

  if (
    context.isRouteEnd &&
    boundaryLocationName
  )
  {
    occurrences.push({
      id: crypto.randomUUID(),
      sourceModuleId: 'regions',
      simulationTime: context.endTime,
      pieceId: context.pieceId,
      entityId: null,
      sectorId: null,
      type: 'location',
      displayLabel: 'F',
      description:
        formatRegionsOccurrenceMessage(
          'boundaryExit',
          {
            piece: context.pieceName,
            location:
              boundaryLocationName,
          }
        ),
      reaction: OccurrenceReactions.Notify,
    });
  }

  /*
   * A final Feature already represents
   * the Route's visible completion.
   *
   * Only create the generic Route End
   * Occurrence when there is no Feature
   * arrival to represent it.
   */
  if (
    context.isRouteEnd &&
    !context.legProfile.endpoint?.featureId &&
    !context.legProfile.endpoint?.boundaryId
  )
  {
    occurrences.push({
      id: crypto.randomUUID(),
      sourceModuleId: 'regions',
      simulationTime: context.endTime,
      pieceId: context.pieceId,
      entityId: null,
      sectorId: null,
      type: 'location',
      displayLabel: 'F',
      description:
        formatRegionsOccurrenceMessage(
          'routeEnd',
          {
            piece: context.pieceName,
          }
        ),
      reaction: OccurrenceReactions.Notify,
    });
  }

  /*
   * Array.sort is stable. Sorting only
   * by simulation time deliberately
   * preserves Regions' semantic ordering
   * for Occurrences at the same instant.
   */
  occurrences.sort(
    (left, right) =>
      left.simulationTime -
        right.simulationTime
  );

  occurrences.push({
    id: crypto.randomUUID(),
    sourceModuleId: 'regions',
    simulationTime: context.endTime,
    pieceId: context.pieceId,
    entityId: null,
    sectorId: null,
    reaction: OccurrenceReactions.None,
  });

  return occurrences;
}

export function createTravelRecalculateOccurrence(
  point: RouteTraversalPoint,
  context: TravelOccurrenceContext,
  title?: string,
  description?: string
): Occurrence
{
  const simulationTime =
    getPointSimulationTime(
      point,
      context
    );

  const remainingDistance =
    Math.max(
      0,
      context.legProfile.distance.value -
        point.distanceFromLegStart.value
    );

  return {
    id: crypto.randomUUID(),
    sourceModuleId: 'regions',
    simulationTime,
    pieceId: context.pieceId,
    entityId: null,
    sectorId: null,
    type: title
      ? 'section'
      : undefined,
    title,
    description,
    reaction: OccurrenceReactions.Recalculate,
    payload: {
      routeLegId: context.routeLeg.id,
      mode: 'recalculate',
      remainingDistance,
      distanceFromLegStart:
        point.distanceFromLegStart.value,
    },
  };
}