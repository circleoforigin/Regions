import { useEffect, useRef, useState } from 'react';
import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';
import type { GlobalMediaSlot, MediaSlotOverride } from '../models/MediaSlot';
import { hostedMediaService } from '../services/media/HostedMediaService';

interface Props {
  featureTypeId?: string;
  showType?: boolean;
  showHeading?: boolean;
  overrides: MediaSlotOverride[];
  inheritedOverrides: MediaSlotOverride[];
  globalSlots: GlobalMediaSlot[];
  featureTypes: FeatureTypeDefinition[];
  readOnly: boolean;
  loading?: boolean;
  onTypeChange: (id: string) => void;
  onOverridesChange: (update: (current: MediaSlotOverride[]) => MediaSlotOverride[]) => void;
  onBusyChange: (busy: boolean) => void;
}
export default function AreaResourcesEditor({ featureTypeId, overrides, inheritedOverrides,
  globalSlots, featureTypes, readOnly, loading, showType = true, showHeading = true, onTypeChange, onOverridesChange, onBusyChange }: Props) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; onBusyChange(false); return () => { mounted.current = false; onBusyChange(false); }; }, [onBusyChange]);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState('');
  async function assign(slot: number, file: File) {
    if (readOnly) return;
    setImporting(slot); onBusyChange(true); setError('');
    try {
      const asset = await hostedMediaService.importLocalFile(file);
      if (!mounted.current) return;
      const override: MediaSlotOverride = { slot, media: {
        mediaType: file.type.startsWith('video/') ? 'video' : 'image', fileId: asset.id,
        filePath: `media/${asset.source.path}`, fileName: asset.originalFileName,
      } };
      onOverridesChange((current) => [...current.filter((item) => item.slot !== slot), override]);
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'Unable to import media.');
    } finally { if (mounted.current) { setImporting(null); onBusyChange(false); } }
  }
  return <div className="area-resources-editor">
    {showType && <label>Type
      <select value={featureTypeId ?? ''} disabled={readOnly || loading}
        onChange={(event) => onTypeChange(event.target.value)}>
        <option value="">No Type</option>
        {featureTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        {featureTypeId && !featureTypes.some((type) => type.id === featureTypeId) &&
          <option value={featureTypeId}>Unavailable Type</option>}
      </select>
    </label>}
    {showHeading && <strong>Media assignments</strong>}
    {readOnly && <p>{loading ? 'Loading Location settings…' : 'Managed in the linked Location Map.'}</p>}
    {globalSlots.length === 0 && <p>No Global Media Slots have been defined.</p>}
    {!loading && [...globalSlots].sort((a,b) => a.slot-b.slot).map((slot) => {
      const own = overrides.find((item) => item.slot === slot.slot);
      const inherited = inheritedOverrides.find((item) => item.slot === slot.slot);
      const media = own?.media ?? inherited?.media ?? slot.media;
      return <div className="area-media-row" key={slot.slot}>
        <span>Slot {slot.slot}</span>
        <span className="area-media-name">{media?.fileName ?? 'Not assigned'}</span>
        <span>{own ? (readOnly ? 'Location Map' : 'Area') : inherited ? 'Map' : 'Global'}</span>
        {!readOnly && <>
          <label className="area-media-upload">{importing === slot.slot ? 'Importing…' : own ? 'Replace…' : 'Override…'}
            <input hidden type="file" accept="image/*,video/*" disabled={importing !== null}
              onChange={(event) => {
                const file = event.target.files?.[0]; event.target.value = '';
                if (file) void assign(slot.slot, file);
              }} />
          </label>
          <button type="button" disabled={!own || importing !== null} onClick={() =>
            onOverridesChange((current) => current.filter((item) => item.slot !== slot.slot))}>Use Map / Global</button>
        </>}
      </div>;
    })}
    {error && <p role="alert">{error}</p>}
  </div>;
}