import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

import type {
  StandalonePathTerminal,
} from '../models/Path';

const COLLECTION = 'path-terminals';

export class PathTerminalRepository {
  async loadTerminal(
    id: string
  ): Promise<StandalonePathTerminal | null> {
    return hostedCollectionRepository.load<StandalonePathTerminal>(
      COLLECTION,
      id
    );
  }

  async loadTerminals(
    ids: string[]
  ): Promise<StandalonePathTerminal[]> {
    if (ids.length === 0) {
      return [];
    }

    const items =
      await hostedCollectionRepository.loadMany<StandalonePathTerminal>(
        COLLECTION,
        ids
      );

    return items.filter(
      (
        item
      ): item is StandalonePathTerminal =>
        item !== null
    );
  }

  async saveTerminal(
    terminal: StandalonePathTerminal
  ): Promise<void> {
    await hostedCollectionRepository.save(
      COLLECTION,
      terminal.id,
      terminal
    );
  }

  async deleteTerminal(
    id: string
  ): Promise<boolean> {
    return hostedCollectionRepository.delete(
      COLLECTION,
      id
    );
  }
}

export const pathTerminalRepository =
  new PathTerminalRepository();