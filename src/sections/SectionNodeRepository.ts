import { hostedCollectionRepository } from '../host/HostedCollectionRepository';
import type { SectionNode } from '../models/Section';

const COLLECTION = 'section-nodes';

export class SectionNodeRepository {
  async loadNodes(ids: string[]): Promise<SectionNode[]> {
    if (ids.length === 0) return [];
    const items = await hostedCollectionRepository.loadMany<SectionNode>(
      COLLECTION,
      ids
    );
    return items.filter((item): item is SectionNode => item !== null);
  }

  async saveNode(node: SectionNode): Promise<void> {
    await hostedCollectionRepository.save(COLLECTION, node.id, node);
  }

  async deleteNode(id: string): Promise<boolean> {
    return hostedCollectionRepository.delete(COLLECTION, id);
  }
}

export const sectionNodeRepository = new SectionNodeRepository();
