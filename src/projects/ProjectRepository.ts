import type {
  Project,
} from '../models/Project';

import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

const PROJECTS_COLLECTION =
  'projects';

export class ProjectRepository {
  async loadProjects(): Promise<Project[]> {
    const projects =
      await hostedCollectionRepository
        .loadAll<Project>(
          PROJECTS_COLLECTION
        );

    return Array.isArray(projects)
      ? projects
      : [];
  }

  async loadProject(projectId: string): Promise<Project | null> {
    return hostedCollectionRepository.load<Project>(
        PROJECTS_COLLECTION,
        projectId
    );
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