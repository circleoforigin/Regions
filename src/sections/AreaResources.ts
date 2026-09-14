import type { Section } from '../models/Section';
import type { Map as RegionMap } from '../models/Map';
import type { MediaSlotOverride } from '../models/MediaSlot';

export function copyAreaResourcesToLocation(area: Section, parentOverrides: MediaSlotOverride[] = []) {
  // Preserve the Area's effective assignments, including inherited Map overrides.
  const slots = new Map(parentOverrides.map((item) => [item.slot, item]));
  for (const item of area.mediaSlotOverrides ?? []) slots.set(item.slot, item);
  return { featureTypeId: area.featureTypeId,
    mediaSlotOverrides: [...slots.values()].map((item) => ({ ...item, media: { ...item.media } })) };
}

export function copyLocationResourcesToArea(map: RegionMap) {
  return { featureTypeId: map.featureTypeId,
    mediaSlotOverrides: (map.mediaSlotOverrides ?? []).map((item) => ({ ...item, media: { ...item.media } })) };
}