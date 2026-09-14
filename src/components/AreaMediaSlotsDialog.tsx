import { useState } from 'react';
import AreaResourcesEditor from './AreaResourcesEditor';
import type { GlobalMediaSlot, MediaSlotOverride } from '../models/MediaSlot';
interface Props {
  overrides: MediaSlotOverride[]; inheritedOverrides: MediaSlotOverride[];
  globalSlots: GlobalMediaSlot[]; readOnly: boolean; loading: boolean;
  onSave: (overrides: MediaSlotOverride[]) => void; onClose: () => void;
}
export default function AreaMediaSlotsDialog({ overrides, inheritedOverrides, globalSlots, readOnly, loading, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(overrides);
  const [busy, setBusy] = useState(false);
  return <div className="dialog-backdrop" onPointerDown={(event) => event.stopPropagation()}>
    <div className="dialog section-properties-dialog" role="dialog" aria-modal="true" aria-label="Area Media Slots">
      <h2>Area Media Slots</h2>
      <AreaResourcesEditor showType={false} showHeading={false} overrides={readOnly ? overrides : draft}
        inheritedOverrides={inheritedOverrides} globalSlots={globalSlots} featureTypes={[]}
        readOnly={readOnly} loading={loading} onTypeChange={() => {}}
        onOverridesChange={setDraft} onBusyChange={setBusy} />
      <div className="dialog-buttons">
        <button type="button" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
        {!readOnly && <button type="button" disabled={busy} onClick={() => onSave(draft)}>Save</button>}
      </div>
    </div>
  </div>;
}
