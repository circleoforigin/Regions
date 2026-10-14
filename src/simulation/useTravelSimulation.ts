import { useEffect } from 'react';
import type { Feature } from '../models/Feature';
import type { Project } from '../models/Project';
import type {
  Route,
  RouteLeg,
} from '../models/Route';
import { getRouteLegs } from '../models/Route';
import type { ActiveRulesetInteraction } from '../rules/RulesetInteraction';
import { moduleEventBus } from '../host/ModuleBus';
import { generateTravelOccurrences } from '../occurrences/TravelOccurrenceGenerator';

interface TravelSimulationOptions
{
  activeProject: Project | null;
  projectFeatures: Feature[];
  pieceRulesetInteraction:
    ActiveRulesetInteraction | null;

  removeInvalidRoutes:
    (
      validRoutes: Route[]
    ) => void;
}

export function useTravelSimulation(
  options: TravelSimulationOptions
): void
{
  const {
    activeProject,
    projectFeatures,
    pieceRulesetInteraction,
    removeInvalidRoutes,
  } = options;

  const prospectRouteLeg =
    async (
      route: Route,
      routeLeg: RouteLeg,
      startTime: number,
      distanceOverride?: number,
      distanceFromLegStartOverride?: number
    ) =>
    {
      if (!activeProject)
      {
        return false;
      }

      const spatialPiece =
        activeProject.pieces.find(
          (piece) =>
            piece.id === route.pieceId
        );

      if (!spatialPiece)
      {
        throw new Error(
          `Route "${route.id}" has no Piece.`
        );
      }

      const legProfile =
        route.legProfiles?.find(
          (profile) =>
            profile.legId === routeLeg.id
        );

      if (!legProfile)
      {
        throw new Error(
          `Route Leg "${routeLeg.id}" has no compiled profile.`
        );
      }

      const endpointFeature =
        legProfile.endpoint?.featureId
          ? projectFeatures.find(
              (feature) =>
                feature.id ===
                legProfile.endpoint?.featureId
            )
          : undefined;

      const paceField =
        pieceRulesetInteraction
          ?.interaction.fields.find(
            (field) =>
              field.id === 'pace'
          );

      const rulesetData =
        spatialPiece.rulesetData;

      const storedPace =
        rulesetData &&
        rulesetData.rulesetId ===
          pieceRulesetInteraction?.rulesetId &&
        rulesetData.schemaId ===
          pieceRulesetInteraction?.interaction.schemaId
          ? rulesetData.values.pace
          : undefined;

      const pace =
        typeof storedPace === 'string'
          ? storedPace
          : typeof paceField?.defaultValue === 'string'
            ? paceField.defaultValue
            : undefined;

      if (!pace)
      {
        throw new Error(
          `Piece "${spatialPiece.id}" requires a Ruleset-defined Pace.`
        );
      }

      const distance =
        distanceOverride !== undefined
          ? {
              value: distanceOverride,
              unit: legProfile.distance.unit,
            }
          : legProfile.distance;

      const distanceFromLegStart =
        distanceFromLegStartOverride !== undefined
          ? distanceFromLegStartOverride
          : distanceOverride !== undefined
            ? Math.max(
                0,
                legProfile.distance.value -
                  distanceOverride
              )
            : 0;

      const result =
        await moduleEventBus.request<{
          duration: number;
          speedMph: number;
        }>(
          'rules.executeFunction',
          {
            functionId: 'TravelTime',

            input: {
              distance,
              pace,
              entityIds:
                spatialPiece.entityIds,

              area: legProfile.area
                ? {
                    rulesetData:
                      legProfile.area.rulesetData ??
                      null,
                  }
                : null,

              path: legProfile.path
                ? {
                    type:
                      legProfile.path.type,

                    rulesetData:
                      legProfile.path.rulesetData ??
                      null,
                  }
                : null,
            },
          }
        );

      const endTime =
        startTime +
        result.duration;

      moduleEventBus.emit(
        'Regions.TravelLegProspected',
        {
          pieceId: spatialPiece.id,
          routeId: route.id,
          routeLegId: routeLeg.id,
          startTime,
          endTime,
          duration: result.duration,
          speedMph: result.speedMph,
          distance,

          startDistanceFromLegStart:
            distanceFromLegStart,

          endDistanceFromLegStart:
            distanceFromLegStart +
            distance.value,

          pace,
          endpoint: legProfile.endpoint,
          piece: spatialPiece,
          route,
          routeLeg,
        }
      );

      const routeLegs =
        getRouteLegs(route);

      const isRouteEnd =
        routeLeg.index ===
        routeLegs.length - 1;

      const occurrences =
        generateTravelOccurrences({
          pieceId: spatialPiece.id,
          pieceName: spatialPiece.name,

          endpointFeatureName:
            endpointFeature?.name,

          routeLeg,
          legProfile,
          isRouteEnd,
          startTime,
          endTime,
          duration: result.duration,
          distanceFromLegStart,
        });

      await moduleEventBus.request(
        'occurrences.submit',
        {
          pieceId: spatialPiece.id,
          occurrences,
        }
      );

      return true;
    };

  useEffect(() =>
  {
    const unregister =
      moduleEventBus.registerRequestHandler(
        'Regions.Travel',
        async (message) =>
        {
          const payload =
            message.payload as
              | {
                  startTime?: number;
                }
              | undefined;

          if (
            !activeProject ||
            typeof payload?.startTime !==
              'number'
          )
          {
            return;
          }

          const validPieceIds =
            new Set(
              activeProject.pieces.map(
                (piece) =>
                  piece.id
              )
            );

          const validRoutes =
            activeProject.routes.filter(
              (route) =>
                validPieceIds.has(
                  route.pieceId
                )
            );

          if (
            validRoutes.length !==
            activeProject.routes.length
          )
          {
            removeInvalidRoutes(
              validRoutes
            );
          }

          const travelingRoutes =
            validRoutes.filter(
              (route) =>
                getRouteLegs(route).length >
                0
            );

          if (
            travelingRoutes.length === 0
          )
          {
            return {
              accepted: false,
              prospectedCount: 0,
            };
          }

          let prospectedCount = 0;

          for (
            const route
            of travelingRoutes
          )
          {
            const routeLeg =
              getRouteLegs(route)[0];

            if (!routeLeg)
            {
              continue;
            }

            const prospected =
              await prospectRouteLeg(
                route,
                routeLeg,
                payload.startTime
              );

            if (prospected)
            {
              prospectedCount += 1;
            }
          }

          return {
            accepted:
              prospectedCount > 0,

            prospectedCount,
          };
        }
      );

    return () =>
    {
      unregister();
    };
  }, [
    activeProject,
    projectFeatures,
    pieceRulesetInteraction,
    removeInvalidRoutes,
  ]);

  useEffect(() =>
  {
    const unregister =
      moduleEventBus.registerRequestHandler(
        'Regions.ContinueTravel',
        async (message) =>
        {
          const payload =
            message.payload as
              | {
                  pieceId?: string;
                  routeLegId?: string;
                  startTime?: number;

                  mode?:
                    | 'recalculate'
                    | 'next-leg';

                  remainingDistance?: number;
                  distanceFromLegStart?: number;
                }
              | undefined;

          if (
            !activeProject ||
            !payload?.pieceId ||
            !payload.routeLegId ||
            typeof payload.startTime !==
              'number' ||
            !payload.mode
          )
          {
            return;
          }

          const route =
            activeProject.routes.find(
              (candidate) =>
                candidate.pieceId ===
                payload.pieceId
            );

          if (!route)
          {
            throw new Error(
              `Piece "${payload.pieceId}" has no Route.`
            );
          }

          const routeLegs =
            getRouteLegs(route);

          const currentLeg =
            routeLegs.find(
              (leg) =>
                leg.id ===
                payload.routeLegId
            );

          if (!currentLeg)
          {
            throw new Error(
              `Route Leg "${payload.routeLegId}" was not found.`
            );
          }

          const targetLeg =
            payload.mode === 'next-leg'
              ? routeLegs[
                  currentLeg.index + 1
                ]
              : currentLeg;

          if (!targetLeg)
          {
            return {
              accepted: false,
              routeComplete: true,
            };
          }

          if (
            payload.mode ===
              'recalculate' &&
            (
              typeof payload
                .distanceFromLegStart !==
                'number' ||
              payload.distanceFromLegStart <
                0
            )
          )
          {
            throw new Error(
              'Regions.ContinueTravel recalculation requires distanceFromLegStart.'
            );
          }

          let remainingDistance =
            payload.remainingDistance;

          if (
            payload.mode ===
              'recalculate' &&
            remainingDistance === undefined
          )
          {
            const legProfile =
              route.legProfiles?.find(
                (candidate) =>
                  candidate.legId ===
                  currentLeg.id
              );

            if (!legProfile)
            {
              throw new Error(
                `Route Leg "${currentLeg.id}" has no compiled profile.`
              );
            }

            remainingDistance =
              Math.max(
                0,
                legProfile.distance.value -
                payload
                  .distanceFromLegStart!
              );
          }

          if (
            payload.mode ===
              'recalculate' &&
            (
              typeof remainingDistance !==
                'number' ||
              remainingDistance < 0
            )
          )
          {
            throw new Error(
              'Regions.ContinueTravel recalculation requires a valid remaining distance.'
            );
          }

          const prospected =
            await prospectRouteLeg(
              route,
              targetLeg,
              payload.startTime,

              payload.mode ===
                'recalculate'
                ? remainingDistance
                : undefined,

              payload.mode ===
                'recalculate'
                ? payload
                    .distanceFromLegStart
                : undefined
            );

          return {
            accepted: prospected,
            routeComplete: false,
            routeId: route.id,
            routeLegId: targetLeg.id,
          };
        }
      );

    return () =>
    {
      unregister();
    };
  }, [
    activeProject,
    projectFeatures,
    pieceRulesetInteraction,
  ]);
}