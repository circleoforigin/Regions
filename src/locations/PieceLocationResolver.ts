import type { LocationContext } from '../events/LocationEvents';
import type { Map as RegionMap } from '../models/Map';
import type { Piece } from '../models/Piece';
import type { Project } from '../models/Project';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import { mapRepository } from '../maps/MapRepository';
import { resolveArea } from '../sections/AreaContext';
import { sectionRepository } from '../sections/SectionRepository';
import { sectionEdgeRepository } from '../sections/SectionEdgeRepository';
import { sectionNodeRepository } from '../sections/SectionNodeRepository';

interface PieceLocationResolverContext
{
  activeMapId: string | null;
  loadedSectionsMapId: string | null;
  activeSections: Section[];
  activeSectionEdges: SectionEdge[];
  activeSectionNodes: SectionNode[];
  pendingMaps: RegionMap[];
  projectMaps: RegionMap[];
  preferredAreaId?: string;
}

export interface PieceLocation
{
  context: LocationContext;
  area: Section | undefined;
  resourceMap: RegionMap;
}

export async function resolvePieceLocation(
  map: RegionMap,
  project: Project,
  piece: Piece,
  resolverContext: PieceLocationResolverContext,
  resolvedArea?: {
    area: Section | undefined;
  }
): Promise<PieceLocation>
{
  let area = resolvedArea?.area;

  if (!resolvedArea)
  {
    if (
      map.id === resolverContext.activeMapId &&
      resolverContext.loadedSectionsMapId === map.id
    )
    {
      area = resolveArea(
        map.id,
        piece.position,
        resolverContext.activeSections,
        resolverContext.activeSectionEdges,
        resolverContext.activeSectionNodes,
        resolverContext.preferredAreaId
      );
    }
    else
    {
      const sections =
        await sectionRepository.loadSections(
          map.sectionIds ?? []
        );

      const edges =
        await sectionEdgeRepository.loadEdges(
          sections.flatMap(
            (section) =>
              section.edgeIds
          )
        );

      const nodes =
        await sectionNodeRepository.loadNodes(
          [
            ...new Set(
              edges.flatMap(
                (edge) => [
                  edge.startNodeId,
                  edge.endNodeId,
                ]
              )
            ),
          ]
        );

      area = resolveArea(
        map.id,
        piece.position,
        sections,
        edges,
        nodes,
        resolverContext.preferredAreaId
      );
    }
  }

  let resourceMap = map;

  if (area?.targetMapId)
  {
    const linkedMap =
      resolverContext.pendingMaps.find(
        (item) =>
          item.id === area.targetMapId
      ) ??
      resolverContext.projectMaps.find(
        (item) =>
          item.id === area.targetMapId
      ) ??
      await mapRepository.loadMap(
        area.targetMapId
      );

    if (!linkedMap)
    {
      throw new Error(
        'The Area’s linked Location settings could not be loaded.'
      );
    }

    resourceMap = linkedMap;
  }

  const typeId =
    area && !area.targetMapId
      ? area.featureTypeId
      : resourceMap.featureTypeId;

  return {
    area,
    resourceMap,

    context: {
      contextKind:
        area
          ? 'area'
          : 'map',

      locationId:
        area?.id ??
        map.id,

      locationName:
        area?.name ??
        map.name,

      locationType:
        project.featureTypes.find(
          (type) =>
            type.id === typeId
        )?.name ?? '',
    },
  };
}