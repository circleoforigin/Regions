import type {
  GlobalMediaSlot,
  MediaSlotOverride,
  ResolvedMediaSlot,
} from '../models/MediaSlot';

export function areGlobalMediaSlotsComplete(
  slots: GlobalMediaSlot[]
): boolean {
  return (
    slots.length > 0 &&
    slots.every(
      (slot) =>
        slot.media !== undefined
    )
  );
}

export function resolveMediaSlots(
  globalSlots:
    GlobalMediaSlot[],

  mapOverrides:
    MediaSlotOverride[] = [],

  areaOverrides:
    MediaSlotOverride[] = []
): ResolvedMediaSlot[] {
  if (
    !areGlobalMediaSlotsComplete(
      globalSlots
    )
  ) {
    return [];
  }

  const mapBySlot =
    new Map(
      mapOverrides.map(
        (override) => [
          override.slot,
          override,
        ]
      )
    );

  const areaBySlot =
    new Map(
      areaOverrides.map(
        (override) => [
          override.slot,
          override,
        ]
      )
    );

  return globalSlots
    .slice()
    .sort(
      (left, right) =>
        left.slot -
        right.slot
    )
    .flatMap(
      (
        globalSlot
      ): ResolvedMediaSlot[] => {
        const globalMedia =
          globalSlot.media;

        if (!globalMedia) {
          return [];
        }

        const areaOverride =
          areaBySlot.get(
            globalSlot.slot
          );

        if (areaOverride) {
          return [
            {
              slot:
                globalSlot.slot,

              ...areaOverride.media,

              source:
                'area',
            },
          ];
        }

        const mapOverride =
          mapBySlot.get(
            globalSlot.slot
          );

        if (mapOverride) {
          return [
            {
              slot:
                globalSlot.slot,

              ...mapOverride.media,

              source:
                'map',
            },
          ];
        }

        return [
          {
            slot:
              globalSlot.slot,

            ...globalMedia,

            source:
              'global',
          },
        ];
      }
    );
}