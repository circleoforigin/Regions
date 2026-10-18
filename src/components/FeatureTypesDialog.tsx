
import {
  useState,
} from 'react';
import '../css/FeatureTypesDialog.css';
import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';
import { featureTypePresets } from '../structure/FeatureTypePresets';

interface FeatureTypesDialogProps {
  featureTypes: FeatureTypeDefinition[];

  onAdd: (name: string) => boolean;

  onAddPreset: (
    presetId: string
  ) => boolean;

  onRename: (
    id: string,
    name: string
  ) => boolean;

  onDelete: (id: string) => void;

  onClose: () => void;
}

function FeatureTypesDialog({
  featureTypes,
  onAdd,
  onAddPreset,
  onRename,
  onDelete,
  onClose,
}: FeatureTypesDialogProps) {
  const [
    selectedPresetId,
    setSelectedPresetId,
  ] = useState<string | null>(null);

  const [
    selectedTypeId,
    setSelectedTypeId,
  ] = useState<string | null>(null);

  const [
    customName,
    setCustomName,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const availablePresets =
    featureTypePresets.filter(
      (preset) =>
        !featureTypes.some(
          (type) =>
            type.presetId === preset.presetId
        )
    );

  const selectedPreset =
    featureTypePresets.find(
      (preset) =>
        preset.presetId === selectedPresetId
    ) ?? null;

  const selectedType =
    featureTypes.find(
      (type) =>
        type.id === selectedTypeId
    ) ?? null;

  function selectPreset(
    presetId: string
  ) {
    const preset =
      featureTypePresets.find(
        (item) =>
          item.presetId === presetId
      );

    if (!preset) return;

    setSelectedPresetId(presetId);
    setSelectedTypeId(null);
    setCustomName(preset.name);
    setError(null);
  }

  function selectType(
    type: FeatureTypeDefinition
  ) {
    setSelectedTypeId(type.id);
    setSelectedPresetId(null);
    setCustomName(type.name);
    setError(null);
  }

  function clearSelection() {
    setSelectedPresetId(null);
    setSelectedTypeId(null);
    setCustomName('');
    setError(null);
  }

  function addPreset() {
    if (!selectedPreset) return;

    if (!onAddPreset(selectedPreset.presetId)) {
      setError(
        'This preset could not be added.'
      );
      return;
    }

    clearSelection();
  }

  function addCustomType() {
    const name = customName.trim();

    if (!name) return;

    if (!onAdd(name)) {
      setError(
        'Feature Type names must be unique.'
      );
      return;
    }

    clearSelection();
  }

  function renameType() {
    if (!selectedType) return;

    const name = customName.trim();

    if (!name) {
      setError('Enter a type name.');
      return;
    }

    if (!onRename(selectedType.id, name)) {
      setError(
        'Feature Type names must be unique.'
      );
      return;
    }

    setError(null);
  }

  function removeType() {
    if (!selectedType) return;

    onDelete(selectedType.id);
    clearSelection();
  }

  let transferLabel = 'SELECT';
let transferDisabled = true;
let transferAction: (() => void) | undefined;

if (selectedPreset) {
  transferLabel = 'ADD';
  transferDisabled = false;
  transferAction = addPreset;
} else if (selectedType) {
  transferLabel = 'REMOVE';
  transferDisabled = false;
  transferAction = removeType;
}

  return (
    <div className="dialog-backdrop">
<div className="dialog structure-dialog feature-types-dialog">
        <h2>Feature Types</h2>

        <div className="structure-list-heading">
          <h3>Presets</h3>

<button
  type="button"
  disabled={transferDisabled}
  onClick={() => {
    transferAction?.();
  }}
>
  {transferLabel}
</button>

          <h3>Included</h3>
        </div>

        <div className="structure-columns">
          <div className="structure-list">
            {availablePresets.map(
              (preset) => (
                <button
                  key={preset.presetId}
                  type="button"
                  className={
                    selectedPresetId ===
                    preset.presetId
                      ? 'structure-list-item selected'
                      : 'structure-list-item'
                  }
                  onClick={() =>
                    selectPreset(
                      preset.presetId
                    )
                  }
                >
                  {preset.name}
                </button>
              )
            )}
          </div>

          <div className="structure-list">
            {featureTypes.map(
              (type) => (
                <button
                  key={type.id}
                  type="button"
                  className={
                    selectedTypeId === type.id
                      ? 'structure-list-item selected'
                      : 'structure-list-item'
                  }
                  onClick={() =>
                    selectType(type)
                  }
                >
                  {type.name}
                </button>
              )
            )}
          </div>
        </div>

        <div className="structure-custom-field">
          <h3>
            {selectedPreset
              ? 'Preset'
              : selectedType
                ? 'Edit Type'
                : 'Create Custom Type'}
          </h3>

          <div className="structure-custom-row">
            <label>
              <span>Name</span>

              <input
                type="text"
                value={customName}
                disabled={Boolean(
                  selectedPreset
                )}
                onChange={(event) =>
                  setCustomName(
                    event.target.value
                  )
                }
              />
            </label>

            {!selectedPreset && (
              <button
                type="button"
                disabled={
                  !customName.trim()
                }
                onClick={
                  selectedType
                    ? renameType
                    : addCustomType
                }
              >
                {selectedType
                  ? 'Save'
                  : 'Add Type'}
              </button>
            )}
          </div>

          {error && (
            <div className="feature-types-error">
              {error}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button
            type="button"
            onClick={onClose}
          >
            Return
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeatureTypesDialog;
