import { useEffect, useRef, useState } from 'react';

import type {
  GlobalMediaSlot,
  MediaSlotMedia,
  MediaSlotOverride,
} from '../models/MediaSlot';
import { hostedMediaService } from '../services/media/HostedMediaService';

interface Props {
  overrides: MediaSlotOverride[];
  inheritedOverrides: MediaSlotOverride[];
  globalSlots: GlobalMediaSlot[];
  readOnly: boolean;
  loading: boolean;
  onSave: (overrides: MediaSlotOverride[]) => void;
  onClose: () => void;
}

export default function AreaMediaSlotsDialog({
  overrides,
  inheritedOverrides,
  globalSlots,
  readOnly,
  loading,
  onSave,
  onClose,
}: Props) {
  const [draftOverrides, setDraftOverrides] = useState<MediaSlotOverride[]>(
    () => overrides.slice()
  );
  const [importingSlot, setImportingSlot] = useState<number | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function getOverride(slot: number) {
    return draftOverrides.find((override) => override.slot === slot);
  }

  async function assignFile(slot: number, file: File) {
    if (readOnly) return;
    setImportingSlot(slot);
    setError('');
    try {
      const asset = await hostedMediaService.importLocalFile(file);
      if (!mounted.current) return;
      const media: MediaSlotMedia = {
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        fileId: asset.id,
        filePath: `media/${asset.source.path}`,
        fileName: asset.originalFileName,
      };
      setDraftOverrides((current) => [
        ...current.filter((override) => override.slot !== slot),
        { slot, media },
      ]);
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure instanceof Error ? failure.message : 'Unable to import media.'
        );
      }
    } finally {
      if (mounted.current) setImportingSlot(null);
    }
  }

  function useInherited(slot: number) {
    setDraftOverrides((current) =>
      current.filter((override) => override.slot !== slot)
    );
  }

  const busy = importingSlot !== null;

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="dialog global-media-slots-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Area Media Slots"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h2>Area Media Slots</h2>

        <p>
          {readOnly
            ? 'Managed in the linked Location Map.'
            : 'Override Map and Global Media Slots for this Area.'}
        </p>

        {loading && <p>Loading Location settings...</p>}
        {!loading && globalSlots.length === 0 && (
          <p>No media slots have been created.</p>
        )}

        {!loading &&
          globalSlots
            .slice()
            .sort((left, right) => left.slot - right.slot)
            .map((globalSlot) => {
              const override = getOverride(globalSlot.slot);
              const mapOverride = inheritedOverrides.find(
                (item) => item.slot === globalSlot.slot
              );
              const displayedMedia =
                override?.media ?? mapOverride?.media ?? globalSlot.media;
              const source = override
                ? readOnly
                  ? 'Location Map'
                  : 'Area'
                : mapOverride
                  ? 'Map'
                  : 'Global';

              return (
                <div key={globalSlot.slot} className="media-slot-row">
                  <strong>Slot {globalSlot.slot}</strong>
                  <span title={displayedMedia?.fileName}>
                    {displayedMedia?.fileName ?? 'Not assigned'}
                  </span>
                  <span>{source}</span>

                  <label>
                    <span className="button">
                      {importingSlot === globalSlot.slot
                        ? 'Importing...'
                        : override
                          ? 'Replace...'
                          : 'Override...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      disabled={readOnly || busy}
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void assignFile(globalSlot.slot, file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={readOnly || busy || !override}
                    onClick={() => useInherited(globalSlot.slot)}
                  >
                    {mapOverride ? 'Use Map' : 'Use Global'}
                  </button>
                </div>
              );
            })}

        {error && <p role="alert">{error}</p>}

        <div className="global-media-slots-actions">
          <div />
          <div />
          <div />
          <button type="button" disabled={busy} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={readOnly || busy || loading}
            onClick={() => onSave(draftOverrides)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
