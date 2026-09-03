import { hostedCollectionRepository } from '../host/HostedCollectionRepository';
import type { Section } from '../models/Section';

const COLLECTION = 'sections';

export class SectionRepository {
  async loadSections(ids: string[]): Promise<Section[]> {
    if (ids.length === 0) return [];
    const items = await hostedCollectionRepository.loadMany<Section>(
      COLLECTION,
      ids
    );
    return items.filter((item): item is Section => item !== null);
  }

  async saveSection(section: Section): Promise<void> {
    await hostedCollectionRepository.save(COLLECTION, section.id, section);
  }

  async deleteSection(id: string): Promise<boolean> {
    return hostedCollectionRepository.delete(COLLECTION, id);
  }
}

export const sectionRepository = new SectionRepository();
