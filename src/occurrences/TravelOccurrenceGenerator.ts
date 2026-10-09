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
  routeLeg: RouteLeg;
  legProfile: RouteLegProfile;
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
  /*
   * TRAVEL OCCURRENCE POLICY
   *
   * This is the decision point for Regions-owned
   * prospective spatial Occurrences.
   *
   * RouteLegProfile.points contains the spatial
   * trigger points encountered while walking the
   * RouteLeg. As Regions gains additional spatial
   * systems, inspect each point here and determine
   * whether it represents a meaningful occurrence:
   *
   * - Sector/context changes
   * - Weather-context changes
   * - Other Regions-owned spatial triggers
   *
   * Return null when the point requires no
   * Occurrence.
   *
   * Recalculate Occurrences must include the
   * continuation data required by
   * Regions.ContinueTravel.
   */

  void point;
  void context;

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

    if (occurrence)
    {
      occurrences.push(occurrence);
    }
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
    reaction:
      OccurrenceReactions.Recalculate,
    payload: {
      routeLegId: context.routeLeg.id,
      mode: 'recalculate',
      remainingDistance,
    },
  };
}