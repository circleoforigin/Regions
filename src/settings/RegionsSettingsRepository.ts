import { hostedCollectionRepository } from '../host/HostedCollectionRepository';

const COLLECTION = 'settings';
const KEY = 'regions';

export interface RegionsSettings {
  autosaveEnabled: boolean;
  edgeScrollingEnabled: boolean;
}

export const DEFAULT_REGIONS_SETTINGS: RegionsSettings = {
  autosaveEnabled: false,
  edgeScrollingEnabled: true,
};

function normalizeSettings(
  settings: Partial<RegionsSettings> | null
): RegionsSettings {
  return {
    autosaveEnabled: settings?.autosaveEnabled ?? false,
    edgeScrollingEnabled: settings?.edgeScrollingEnabled ?? true,
  };
}

export class RegionsSettingsRepository {
  async load(): Promise<RegionsSettings> {
    const settings = await hostedCollectionRepository.load<
      Partial<RegionsSettings>
    >(COLLECTION, KEY);
    return normalizeSettings(settings);
  }

  async save(settings: RegionsSettings): Promise<void> {
    await hostedCollectionRepository.save(COLLECTION, KEY, settings);
  }
}

export const regionsSettingsRepository = new RegionsSettingsRepository();
