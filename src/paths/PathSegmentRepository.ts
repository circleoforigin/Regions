import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

import type {
  PathSegment,
} from '../models/Path';

const COLLECTION = 'path-segments';

export class PathSegmentRepository
{
  async loadSegment(
    id: string
  ): Promise<PathSegment | null>
  {
    const segment =
      await hostedCollectionRepository.load<PathSegment>(
        COLLECTION,
        id
      );

    return segment
      ? {
          ...segment,
          type: segment.type ?? 'path',
        }
      : null;
  }

  async loadSegments(
    ids: string[]
  ): Promise<PathSegment[]>
  {
    if (ids.length === 0)
    {
      return [];
    }

    const items =
      await hostedCollectionRepository.loadMany<PathSegment>(
        COLLECTION,
        ids
      );

    return items
      .filter(
        (item): item is PathSegment =>
          item !== null
      )
      .map((segment) => ({
        ...segment,
        type: segment.type ?? 'path',
      }));
  }

  async saveSegment(
    segment: PathSegment
  ): Promise<void> {
    await hostedCollectionRepository.save(
      COLLECTION,
      segment.id,
      segment
    );
  }

  async deleteSegment(
    id: string
  ): Promise<boolean> {
    return hostedCollectionRepository.delete(
      COLLECTION,
      id
    );
  }
}

export const pathSegmentRepository =
  new PathSegmentRepository();