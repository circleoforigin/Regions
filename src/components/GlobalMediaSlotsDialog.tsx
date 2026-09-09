import {
  useState,
} from 'react';

import type {
  GlobalMediaSlot,
  MediaSlotType,
} from '../models/MediaSlot';

import {
  hostedMediaService,
} from '../services/media/HostedMediaService';

interface GlobalMediaSlotsDialogProps {
  slots: GlobalMediaSlot[];

  onSave: (
    slots: GlobalMediaSlot[]
  ) => void;

  onClose: () => void;
}

function GlobalMediaSlotsDialog({
  slots,
  onSave,
  onClose,
}: GlobalMediaSlotsDialogProps) {
  const [
    draftSlots,
    setDraftSlots,
  ] = useState<GlobalMediaSlot[]>(
    () =>
      slots
        .slice()
        .sort(
          (left, right) =>
            left.slot -
            right.slot
        )
  );

  const [
    importingSlot,
    setImportingSlot,
  ] = useState<number | null>(
    null
  );

  function addSlot() {
    setDraftSlots(
      (current) => [
        ...current,
        {
          slot:
            current.length + 1,
        },
      ]
    );
  }

  function removeLastSlot() {
    setDraftSlots(
      (current) =>
        current.slice(
          0,
          -1
        )
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
          .importLocalFile(
            file
          );

      const mediaType:
        MediaSlotType =
          file.type.startsWith(
            'video/'
          )
            ? 'video'
            : 'image';

      setDraftSlots(
        (current) =>
          current.map(
            (slot) =>
              slot.slot ===
              slotNumber
                ? {
                    ...slot,

                    media: {
                      mediaType,

                      fileId:
                        asset.id,

                      filePath:
                        `media/${asset.source.path}`,

                      fileName:
                        asset.originalFileName,
                    },
                  }
                : slot
          )
      );
    } finally {
      setImportingSlot(
        null
      );
    }
  }

  function clearSlot(
    slotNumber: number
  ) {
    setDraftSlots(
      (current) =>
        current.map(
          (slot) =>
            slot.slot ===
            slotNumber
              ? {
                  slot:
                    slot.slot,
                }
              : slot
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
        className="dialog global-media-slots-dialog"
        onPointerDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        <h2>
          Global Media Slots
        </h2>

        <p>
            Assign media for use during cross-module events.
            Map and Area level media assignment will remain
            deactivated until at least one slot is filled and
            while any slots are empty.
        </p>

        {draftSlots.length ===
          0 && (
          <p>
            No media slots have
            been created.
          </p>
        )}

        {draftSlots.map(
          (slot) => (
            <div
              key={slot.slot}
              className="media-slot-row"
            >
              <strong>
                Slot {slot.slot}
              </strong>

              <span>
                {slot.media
                  ?.fileName ??
                  'Not assigned'}
              </span>

              {slot.media && (
                <span>
                  {slot.media
                    .mediaType}
                </span>
              )}

              <label>
                <span
                  className="button"
                >
                  {importingSlot ===
                  slot.slot
                    ? 'Importing...'
                    : slot.media
                      ? 'Replace...'
                      : 'Assign...'}
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
                        slot.slot,
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
                  !slot.media
                }
                onClick={() =>
                  clearSlot(
                    slot.slot
                  )
                }
              >
                Clear
              </button>
            </div>
          )
        )}

        <div
            className="global-media-slots-actions"
        >
          <button
            type="button"
            onClick={
              addSlot
            }
          >
            Add Slot
          </button>

          <button
            type="button"
            disabled={
              draftSlots.length ===
              0
            }
            onClick={
              removeLastSlot
            }
          >
            Remove Last Slot
          </button>

          <div
            style={{
              flex: 1,
            }}
          />          

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
                draftSlots
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

export default GlobalMediaSlotsDialog;