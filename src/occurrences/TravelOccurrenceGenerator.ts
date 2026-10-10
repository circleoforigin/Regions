import {
  OccurrenceReactions,
  type Occurrence,
} from '@settingforge/module-sdk';
import type {
  RouteLeg,
  RouteLegProfile,
  RouteTraversalPoint,
} from '../models/Route';

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

    if (occurrence.reaction === OccurrenceReactions.Recalculate)
    {
      return occurrences;
    }
  }

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
        `${context.pieceName} arrives at ` +
        `${context.endpointFeatureName}.`,
      reaction: OccurrenceReactions.Notify,
    });
  }
  else if (context.isRouteEnd)
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
        `${context.pieceName} reaches the end of its Route.`,
      reaction: OccurrenceReactions.Notify,
    });
  }

  occurrences.sort(
    (left, right) =>
      left.simulationTime -
        right.simulationTime ||
      left.id.localeCompare(right.id)
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