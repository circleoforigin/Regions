import {
  useState,
} from 'react';

import type {
  GlobalMediaSlot,
  MediaSlotOverride,
  MediaSlotType,
} from '../models/MediaSlot';

import {
  hostedMediaService,
} from '../services/media/HostedMediaService';

interface MapMediaSlotsDialogProps {
  globalSlots:
    GlobalMediaSlot[];

  overrides:
    MediaSlotOverride[];

  onSave: (
    overrides:
      MediaSlotOverride[]
  ) => void;

  onClose: () => void;
}

function MapMediaSlotsDialog({
  globalSlots,
  overrides,
  onSave,
  onClose,
}: MapMediaSlotsDialogProps) {
  const [
    draftOverrides,
    setDraftOverrides,
  ] = useState<
    MediaSlotOverride[]
  >(() => [...overrides]);

  const [
    importingSlot,
    setImportingSlot,
  ] = useState<number | null>(
    null
  );

  function getOverride(
    slotNumber: number
  ) {
    return draftOverrides.find(
      (override) =>
        override.slot ===
        slotNumber
    );
  }

  async function assignFile(
    slotNumber: number,
    file: File
  ) {
    setImportingSlot(
      slotNumber
    );

    try {
      const asset =
        await hostedMediaService
          .importLocalFile(file);

      const mediaType:
        MediaSlotType =
          file.type.startsWith(
            'video/'
          )
            ? 'video'
            : 'image';

      const nextOverride:
        MediaSlotOverride = {
          slot: slotNumber,

          media: {
            mediaType,

            fileId:
              asset.id,

            filePath:
              `media/${asset.source.path}`,

            fileName:
              asset.originalFileName,
          },
        };

      setDraftOverrides(
        (current) => [
          ...current.filter(
            (override) =>
              override.slot !==
              slotNumber
          ),

          nextOverride,
        ]
      );
    } finally {
      setImportingSlot(
        null
      );
    }
  }

  function useGlobal(
    slotNumber: number
  ) {
    setDraftOverrides(
      (current) =>
        current.filter(
          (override) =>
            override.slot !==
            slotNumber
        )
    );
  }

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={
        onClose
      }
    >
      <div
        className="dialog map-media-slots-dialog"
        onPointerDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <h2>
          Map Media Slots
        </h2>

        <p>
          Override Global Media
          Slots for this Map.
        </p>

        {globalSlots
          .slice()
          .sort(
            (left, right) =>
              left.slot -
              right.slot
          )
          .map((globalSlot) => {
            const override =
              getOverride(
                globalSlot.slot
              );

            const displayedMedia =
              override?.media ??
              globalSlot.media;

            return (
              <div
                key={
                  globalSlot.slot
                }
                className="map-media-slot-row"
              >
                <strong>
                  Slot{' '}
                  {globalSlot.slot}
                </strong>

                <span>
                  {displayedMedia
                    ?.fileName ??
                    'Not assigned'}
                </span>

                <span>
                  {override
                    ? 'Map'
                    : 'Global'}
                </span>

                <label>
                  <span
                    className="button"
                  >
                    {importingSlot ===
                    globalSlot.slot
                      ? 'Importing...'
                      : override
                        ? 'Replace...'
                        : 'Override...'}
                  </span>

                  <input
                    type="file"
                    accept="image/*,video/*"
                    disabled={
                      importingSlot !==
                      null
                    }
                    hidden
                    onChange={(
                      event
                    ) => {
                      const file =
                        event
                          .target
                          .files?.[0];

                      if (file) {
                        void assignFile(
                          globalSlot.slot,
                          file
                        );
                      }

                      event.target.value =
                        '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    !override
                  }
                  onClick={() =>
                    useGlobal(
                      globalSlot.slot
                    )
                  }
                >
                  Use Global
                </button>
              </div>
            );
          })}

        <div
          className="map-media-slots-actions"
        >
          <div />

          <button
            type="button"
            onClick={
              onClose
            }
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              importingSlot !==
              null
            }
            onClick={() =>
              onSave(
                draftOverrides
              )
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default MapMediaSlotsDialog;