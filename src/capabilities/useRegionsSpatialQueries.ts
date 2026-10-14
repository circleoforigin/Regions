import { useEffect } from 'react';
import type { Map as RegionMap } from '../models/Map';
import type { Project } from '../models/Project';
import { resolveSpatialPiece } from '../models/Piece';
import { featureRepository } from '../features/FeatureRepository';
import { mapRepository } from '../maps/MapRepository';
import { moduleEventBus } from '../host/ModuleBus';

interface RegionsSpatialQueriesOptions
{
  activeProject: Project | null;
  activeMap: RegionMap | null;
}

export function useRegionsSpatialQueries(
  options: RegionsSpatialQueriesOptions
): void
{
  const {
    activeProject,
    activeMap,
  } = options;

  useEffect(() =>
  {
    const unregisterGetPiecePosition =
      moduleEventBus.registerRequestHandler(
        'Regions.GetPiecePosition',
        (request) =>
        {
          const payload =
            request.payload as
              | {
                  pieceId?: string;
                }
              | undefined;

          if (!payload?.pieceId)
          {
            throw new Error(
              'Regions.GetPiecePosition requires pieceId.'
            );
          }

          if (!activeProject)
          {
            throw new Error(
              'No Regions Project is active.'
            );
          }

          const piece =
            activeProject.pieces.find(
              (candidate) =>
                candidate.id ===
                payload.pieceId
            );

          if (!piece)
          {
            throw new Error(
              `Piece "${payload.pieceId}" was not found.`
            );
          }

          const spatialPiece =
            resolveSpatialPiece(
              piece.id,
              activeProject.pieces
            ) ?? piece;

          return {
            pieceId: spatialPiece.id,
            mapId: spatialPiece.mapId,

            position: {
              ...spatialPiece.position,
            },
          };
        }
      );

    const unregisterGetFeaturePosition =
      moduleEventBus.registerRequestHandler(
        'Regions.GetFeaturePosition',
        async (request) =>
        {
          const payload =
            request.payload as
              | {
                  featureId?: string;
                }
              | undefined;

          if (!payload?.featureId)
          {
            throw new Error(
              'Regions.GetFeaturePosition requires featureId.'
            );
          }

          if (!activeProject)
          {
            throw new Error(
              'No Regions Project is active.'
            );
          }

          const maps =
            await mapRepository.loadMaps();

          for (const map of maps)
          {
            if (
              !map.featureIds.includes(
                payload.featureId
              )
            )
            {
              continue;
            }

            const feature =
              await featureRepository.loadFeature(
                payload.featureId
              );

            if (!feature)
            {
              break;
            }

            return {
              featureId: feature.id,
              mapId: map.id,

              position: {
                ...feature.position,
              },
            };
          }

          throw new Error(
            `Feature "${payload.featureId}" was not found.`
          );
        }
      );

    const unregisterGetMapScale =
      moduleEventBus.registerRequestHandler(
        'Regions.GetMapScale',
        async (request) =>
        {
          const payload =
            request.payload as
              | {
                  mapId?: string;
                }
              | undefined;

          if (!payload?.mapId)
          {
            throw new Error(
              'Regions.GetMapScale requires mapId.'
            );
          }

          const map =
            activeMap?.id ===
              payload.mapId
              ? activeMap
              : await mapRepository.loadMap(
                  payload.mapId
                );

          if (!map)
          {
            throw new Error(
              `Map "${payload.mapId}" was not found.`
            );
          }

          const distanceScale =
            map.imageRegistration
              ?.distanceScale;

          return {
            mapId: map.id,

            calibrated:
              distanceScale !== undefined,

            distanceScale:
              distanceScale
                ? {
                    ...distanceScale,
                  }
                : undefined,
          };
        }
      );

    return () =>
    {
      unregisterGetMapScale();
      unregisterGetFeaturePosition();
      unregisterGetPiecePosition();
    };
  }, [
    activeProject,
    activeMap,
  ]);
}