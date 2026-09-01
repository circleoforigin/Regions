import type {
  Project,
} from '../models/Project';

import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

const PROJECTS_COLLECTION =
  'projects';

function normalizeProject(project: Project): Project {
  return {
    ...project,
    featureTypes: Array.isArray(project.featureTypes)
      ? project.featureTypes
      : [],
  };
}

export class ProjectRepository {
  async loadProjects(): Promise<Project[]> {
    const projects =
      await hostedCollectionRepository
        .loadAll<Project>(
          PROJECTS_COLLECTION
        );

    return Array.isArray(projects)
      ? projects.map(normalizeProject)
      : [];
  }

  async loadProject(projectId: string): Promise<Project | null> {
    const project = await hostedCollectionRepository.load<Project>(
        PROJECTS_COLLECTION,
        projectId
    );
    return project ? normalizeProject(project) : null;
  }

  async saveProject(
    project: Project
  ): Promise<void> {
    await hostedCollectionRepository.save(
      PROJECTS_COLLECTION,
      project.id,
      project
    );
  }

  async deleteProject(
    projectId: string
  ): Promise<boolean> {
    return hostedCollectionRepository.delete(
      PROJECTS_COLLECTION,
      projectId
    );
  }
}

export const projectRepository =
  new ProjectRepository();
