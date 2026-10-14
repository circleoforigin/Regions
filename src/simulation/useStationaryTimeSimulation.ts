import { useEffect } from 'react';
import type { Map as RegionMap } from '../models/Map';
import type { Project } from '../models/Project';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import { resolveSpatialPiece } from '../models/Piece';
import { mapRepository } from '../maps/MapRepository';
import { moduleEventBus } from '../host/ModuleBus';
import { resolvePieceLocation } from '../locations/PieceLocationResolver';

interface StationaryTimeSimulationOptions
{
  activeProject: Project | null;
  activeMap: RegionMap | null;
  projectMaps: RegionMap[];
  pendingMaps: RegionMap[];
  activeSections: Section[];
  activeSectionEdges: SectionEdge[];
  activeSectionNodes: SectionNode[];
  loadedSectionsMapId: string | null;
  getPreferredAreaId:
    (
      projectId: string,
      pieceId: string,
      mapId: string
    ) => string | undefined;
}

export function useStationaryTimeSimulation(
  options: StationaryTimeSimulationOptions
): void
{
  const {
    activeProject,
    activeMap,
    projectMaps,
    pendingMaps,
    activeSections,
    activeSectionEdges,
    activeSectionNodes,
    loadedSectionsMapId,
    getPreferredAreaId,
  } = options;

  const resolveMap =
    async (
      mapId: string
    ): Promise<RegionMap | null> =>
    {
      return (
        (
          activeMap?.id === mapId
            ? activeMap
            : undefined
        ) ??
        pendingMaps.find(
          (candidate) =>
            candidate.id === mapId
        ) ??
        projectMaps.find(
          (candidate) =>
            candidate.id === mapId
        ) ??
        await mapRepository.loadMap(
          mapId
        )
      );
    };

  const resolveLocation =
    async (
      project: Project,
      piece: Project['pieces'][number],
      map: RegionMap
    ) =>
    {
      return resolvePieceLocation(
        map,
        project,
        piece,
        {
          activeMapId:
            activeMap?.id ?? null,

          loadedSectionsMapId,

          activeSections,
          activeSectionEdges,
          activeSectionNodes,
          pendingMaps,
          projectMaps,

          preferredAreaId:
            getPreferredAreaId(
              project.id,
              piece.id,
              map.id
            ),
        }
      );
    };

  const emitPieceProspect =
    async (
      project: Project,
      piece: Project['pieces'][number],
      startTime: number,
      endTime: number
    ): Promise<boolean> =>
    {
      const map =
        await resolveMap(
          piece.mapId
        );

      if (!map)
      {
        return false;
      }

      const location =
        await resolveLocation(
          project,
          piece,
          map
        );

      const duration =
        endTime -
        startTime;

      moduleEventBus.emit(
        'Regions.TimeProspected',
        {
          pieceId: piece.id,
          mapId: piece.mapId,
          areaId: location.area?.id,
          startTime,
          endTime,
          duration,
          piece,
          area: location.area,
        }
      );

      await moduleEventBus.request(
        'occurrences.submit',
        {
          pieceId: piece.id,

          occurrences: [
            {
              id: crypto.randomUUID(),
              sourceModuleId: 'regions',
              simulationTime:
                endTime,
              pieceId: piece.id,
              entityId: null,
              sectorId: null,
              reaction: 'none',
            },
          ],
        }
      );

      return true;
    };

  useEffect(() =>
  {
    const unsubscribe =
      moduleEventBus.subscribe(
        'Simulation.TimeProspected',
        (message) =>
        {
          void (async () =>
          {
            const payload =
              message.payload as
                | {
                    startTime?: number;
                    endTime?: number;
                    duration?: number;
                  }
                | undefined;

            if (
              typeof payload?.startTime !== 'number' ||
              typeof payload.endTime !== 'number' ||
              typeof payload.duration !== 'number'
            )
            {
              return;
            }

            try
            {
              if (activeProject)
              {
                const spatialPieces =
                  activeProject.pieces.filter(
                    (piece) =>
                      resolveSpatialPiece(
                        piece.id,
                        activeProject.pieces
                      )?.id === piece.id
                  );

                for (const piece of spatialPieces)
                {
                  await emitPieceProspect(
                    activeProject,
                    piece,
                    payload.startTime,
                    payload.endTime
                  );
                }
              }
            }
            catch (error)
            {
              console.error(
                '[Regions] Stationary prospecting failed.',
                error
              );
            }
            finally
            {
              await moduleEventBus.request(
                'occurrences.submit',
                {
                  pieceId: null,

                  occurrences: [
                    {
                      id: crypto.randomUUID(),
                      sourceModuleId: 'regions',
                      simulationTime:
                        payload.endTime,
                      pieceId: null,
                      entityId: null,
                      sectorId: null,
                      reaction: 'none',
                    },
                  ],
                }
              );
            }
          })().catch(
            (error: unknown) =>
            {
              console.error(
                '[Regions] Unable to complete global time prospect.',
                error
              );
            }
          );
        }
      );

    return () =>
    {
      unsubscribe();
    };
  }, [
    activeProject,
    activeMap,
    projectMaps,
    pendingMaps,
    activeSections,
    activeSectionEdges,
    activeSectionNodes,
    loadedSectionsMapId,
    getPreferredAreaId,
  ]);

  useEffect(() =>
  {
    const unregister =
      moduleEventBus.registerRequestHandler(
        'Regions.ContinueProgressTime',
        async (message) =>
        {
          const payload =
            message.payload as
              | {
                  pieceId?: string;
                  startTime?: number;
                  targetTime?: number;
                }
              | undefined;

          if (
            !activeProject ||
            !payload?.pieceId ||
            typeof payload.startTime !== 'number' ||
            typeof payload.targetTime !== 'number' ||
            payload.targetTime <=
              payload.startTime
          )
          {
            return {
              accepted: false,
            };
          }

          const piece =
            activeProject.pieces.find(
              (candidate) =>
                candidate.id ===
                payload.pieceId
            );

          if (!piece)
          {
            return {
              accepted: false,
            };
          }

          const spatialPiece =
            resolveSpatialPiece(
              piece.id,
              activeProject.pieces
            );

          if (
            !spatialPiece ||
            spatialPiece.id !== piece.id
          )
          {
            return {
              accepted: false,
            };
          }

          const accepted =
            await emitPieceProspect(
              activeProject,
              piece,
              payload.startTime,
              payload.targetTime
            );

          if (!accepted)
          {
            return {
              accepted: false,
            };
          }

          return {
            accepted: true,
            pieceId: piece.id,
            startTime:
              payload.startTime,
            endTime:
              payload.targetTime,
          };
        }
      );

    return () =>
    {
      unregister();
    };
  }, [
    activeProject,
    activeMap,
    projectMaps,
    pendingMaps,
    activeSections,
    activeSectionEdges,
    activeSectionNodes,
    loadedSectionsMapId,
    getPreferredAreaId,
  ]);
}