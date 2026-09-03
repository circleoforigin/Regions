import { hostedCollectionRepository } from '../host/HostedCollectionRepository';
import type { SectionEdge } from '../models/Section';

const COLLECTION = 'section-edges';

export class SectionEdgeRepository {
  async loadEdges(ids: string[]): Promise<SectionEdge[]> {
    if (ids.length === 0) return [];
    const items = await hostedCollectionRepository.loadMany<SectionEdge>(
      COLLECTION,
      ids
    );
    return items.filter((item): item is SectionEdge => item !== null);
  }

  async saveEdge(edge: SectionEdge): Promise<void> {
    await hostedCollectionRepository.save(COLLECTION, edge.id, edge);
  }

  async deleteEdge(id: string): Promise<boolean> {
    return hostedCollectionRepository.delete(COLLECTION, id);
  }
}

export const sectionEdgeRepository = new SectionEdgeRepository();
