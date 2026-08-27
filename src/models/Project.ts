export interface Project {
  id: string;
  name: string;

  mapIds: string[];

  rootMapId?: string;
  activeMapId?: string;

  createdAt: Date;
  updatedAt: Date;
}