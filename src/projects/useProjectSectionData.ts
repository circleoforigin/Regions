import {
  useEffect,
  useState,
} from 'react';
import type { Project } from '../models/Project';
import type { Map as RegionMap } from '../models/Map';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import { sectionRepository } from '../sections/SectionRepository';
import { sectionEdgeRepository } from '../sections/SectionEdgeRepository';
import { sectionNodeRepository } from '../sections/SectionNodeRepository';

interface ProjectSectionDataOptions
{
  activeProject: Project | null;
  activeMap: RegionMap | null;
  projectMaps: RegionMap[];
  activeSections: Section[];
  activeSectionEdges: SectionEdge[];
  activeSectionNodes: SectionNode[];
}

interface ProjectSectionData
{
  projectSections: Section[];
  projectSectionEdges: SectionEdge[];
  projectSectionNodes: SectionNode[];
}

export function useProjectSectionData(
  options: ProjectSectionDataOptions
): ProjectSectionData
{
  const {
    activeProject,
    activeMap,
    projectMaps,
    activeSections,
    activeSectionEdges,
    activeSectionNodes,
  } = options;

  const [
    projectSections,
    setProjectSections,
  ] = useState<Section[]>([]);

  const [
    projectSectionEdges,
    setProjectSectionEdges,
  ] = useState<SectionEdge[]>([]);

  const [
    projectSectionNodes,
    setProjectSectionNodes,
  ] = useState<SectionNode[]>([]);

  useEffect(() =>
  {
    let cancelled = false;

    async function loadProjectSectionData()
    {
      if (!activeProject)
      {
        setProjectSections([]);
        setProjectSectionEdges([]);
        setProjectSectionNodes([]);
        return;
      }

      const storedSections =
        await Promise.all(
          projectMaps
            .filter(
              (map) =>
                map.id !== activeMap?.id
            )
            .map(
              (map) =>
                sectionRepository.loadSections(
                  map.sectionIds ?? []
                )
            )
        );

      const sections = [
        ...storedSections.flat(),
        ...activeSections,
      ];

      const storedEdges =
        await sectionEdgeRepository.loadEdges(
          [
            ...new Set(
              sections
                .filter(
                  (section) =>
                    section.mapId !== activeMap?.id
                )
                .flatMap(
                  (section) =>
                    section.edgeIds
                )
            ),
          ]
        );

      const edges = [
        ...storedEdges,
        ...activeSectionEdges,
      ];

      const storedNodes =
        await sectionNodeRepository.loadNodes(
          [
            ...new Set(
              edges
                .filter(
                  (edge) =>
                    edge.mapId !== activeMap?.id
                )
                .flatMap(
                  (edge) => [
                    edge.startNodeId,
                    edge.endNodeId,
                  ]
                )
            ),
          ]
        );

      const nodes = [
        ...storedNodes,
        ...activeSectionNodes,
      ];

      if (cancelled)
      {
        return;
      }

      setProjectSections(sections);
      setProjectSectionEdges(edges);
      setProjectSectionNodes(nodes);
    }

    void loadProjectSectionData().catch(
      (error) =>
      {
        if (cancelled)
        {
          return;
        }

        console.error(
          'Unable to load Project Section data:',
          error
        );
      }
    );

    return () =>
    {
      cancelled = true;
    };
  }, [
    activeProject,
    activeMap,
    projectMaps,
    activeSections,
    activeSectionEdges,
    activeSectionNodes,
  ]);

  return {
    projectSections,
    projectSectionEdges,
    projectSectionNodes,
  };
}