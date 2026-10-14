import { useEffect } from 'react';
import type { Project } from '../models/Project';
import { projectRepository } from '../projects/ProjectRepository';
import { moduleEventBus } from '../host/ModuleBus';
import type {
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectDeleteRequest,
  ProjectDeleteResponse,
  ProjectListResponse,
  ProjectLoadAcceptedPayload,
  ProjectLoadFailedPayload,
  ProjectLoadedPayload,
  ProjectLoadRequest,
  ProjectRenameRequest,
  ProjectRenameResponse,
} from '@settingforge/module-sdk';

interface ProjectCapabilitiesOptions
{
  activeProject: Project | null;
  projectDirty: boolean;

  createProject:
    (name: string) => Promise<Project>;

  selectProject:
    (project: Project) => Promise<void>;

  saveProject:
    () => Promise<boolean>;

  closeProject:
    () => void;

  setActiveProject:
    (project: Project) => void;

  resetProjectDirty:
    () => void;
}

export function useProjectCapabilities(
  options: ProjectCapabilitiesOptions
): void
{
  const {
    activeProject,
    projectDirty,
    createProject,
    selectProject,
    saveProject,
    closeProject,
    setActiveProject,
    resetProjectDirty,
  } = options;

  useEffect(() =>
  {
    const unregisterList =
      moduleEventBus.registerRequestHandler(
        'project.list',
        async () =>
        {
          const projects =
            await projectRepository.loadProjects();

          const response: ProjectListResponse = {
            projects:
              projects.map(
                (project) => ({
                  projectId: project.id,
                  projectName: project.name,
                })
              ),
          };

          return response;
        }
      );

    const unregisterCreate =
      moduleEventBus.registerRequestHandler(
        'project.create',
        async (request) =>
        {
          const payload =
            request.payload as
              | Partial<ProjectCreateRequest>
              | undefined;

          const name =
            payload?.name?.trim();

          if (!name)
          {
            throw new Error(
              'project.create requires a name.'
            );
          }

          const project =
            await createProject(name);

          const response: ProjectCreateResponse = {
            projectId: project.id,
            projectName: project.name,
          };

          return response;
        }
      );

    const unregisterRename =
      moduleEventBus.registerRequestHandler(
        'project.rename',
        async (request) =>
        {
          const payload =
            request.payload as
              | Partial<ProjectRenameRequest>
              | undefined;

          const projectId =
            payload?.projectId;

          const name =
            payload?.name?.trim();

          if (!projectId || !name)
          {
            throw new Error(
              'project.rename requires projectId and name.'
            );
          }

          const project =
            await projectRepository.loadProject(
              projectId
            );

          if (!project)
          {
            throw new Error(
              `Project "${projectId}" was not found.`
            );
          }

          const renamedProject: Project = {
            ...project,
            name,
            updatedAt: new Date(),
          };

          await projectRepository.saveProject(
            renamedProject
          );

          if (
            activeProject?.id ===
            projectId
          )
          {
            setActiveProject(
              renamedProject
            );

            resetProjectDirty();
          }

          const response: ProjectRenameResponse = {
            projectId: renamedProject.id,
            projectName: renamedProject.name,
          };

          return response;
        }
      );

    const unregisterDelete =
      moduleEventBus.registerRequestHandler(
        'project.delete',
        async (request) =>
        {
          const payload =
            request.payload as
              | Partial<ProjectDeleteRequest>
              | undefined;

          const projectId =
            payload?.projectId;

          if (!projectId)
          {
            throw new Error(
              'project.delete requires projectId.'
            );
          }

          if (
            activeProject?.id ===
            projectId
          )
          {
            throw new Error(
              'The active Project must be closed before it can be deleted.'
            );
          }

          const deleted =
            await projectRepository.deleteProject(
              projectId
            );

          const response: ProjectDeleteResponse = {
            projectId,
            deleted,
          };

          return response;
        }
      );

    const unregisterStatus =
      moduleEventBus.registerRequestHandler(
        'project.status',
        () => ({
          projectId: activeProject?.id,
          projectName: activeProject?.name,
          dirty: projectDirty,
        })
      );

    const unregisterLoad =
      moduleEventBus.registerRequestHandler(
        'project.load',
        async (request) =>
        {
          const payload =
            request.payload as
              | Partial<ProjectLoadRequest>
              | undefined;

          if (
            !payload?.projectId ||
            !payload.loadId
          )
          {
            throw new Error(
              'project.load requires projectId and loadId.'
            );
          }

          const project =
            await projectRepository.loadProject(
              payload.projectId
            );

          if (!project)
          {
            throw new Error(
              `Project "${payload.projectId}" was not found.`
            );
          }

          const projectId =
            project.id;

          const loadId =
            payload.loadId;

          void selectProject(project)
            .then(() =>
            {
              const loaded: ProjectLoadedPayload = {
                projectId,
                loadId,
              };

              moduleEventBus.emit(
                'project.loaded',
                loaded
              );
            })
            .catch((error: unknown) =>
            {
              const failed: ProjectLoadFailedPayload = {
                projectId,
                loadId,

                error:
                  error instanceof Error
                    ? error.message
                    : 'Project restoration failed.',
              };

              moduleEventBus.emit(
                'project.loadFailed',
                failed
              );
            });

          const accepted:
            ProjectLoadAcceptedPayload = {
              accepted: true,
              projectId,
              loadId,
            };

          return accepted;
        }
      );

    const unregisterSave =
      moduleEventBus.registerRequestHandler(
        'project.save',
        async () =>
        {
          if (!activeProject)
          {
            return {
              saved: false,
              projectId: undefined,
            };
          }

          const saved =
            await saveProject();

          if (!saved)
          {
            throw new Error(
              'Unable to save the active project.'
            );
          }

          return {
            saved: true,
            projectId: activeProject.id,
          };
        }
      );

    const unregisterClose =
      moduleEventBus.registerRequestHandler(
        'project.close',
        (request) =>
        {
          const payload =
            request.payload as
              | {
                  discardChanges?: boolean;
                }
              | undefined;

          if (
            projectDirty &&
            !payload?.discardChanges
          )
          {
            throw new Error(
              'Project has unsaved changes.'
            );
          }

          closeProject();

          return {
            closed: true,
          };
        }
      );

    return () =>
    {
      unregisterList();
      unregisterCreate();
      unregisterRename();
      unregisterDelete();
      unregisterStatus();
      unregisterLoad();
      unregisterSave();
      unregisterClose();
    };
  }, [
    activeProject,
    projectDirty,
    createProject,
    selectProject,
    saveProject,
    closeProject,
    setActiveProject,
    resetProjectDirty,
  ]);
}