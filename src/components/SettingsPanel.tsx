import type { ExposureLevel } from '../models/ExposureLevel';

interface SettingsPanelProps
{
  objectType: 'feature' | 'location' | 'area';
  color?: string;
  onColorChange?: (color: string) => void;
  exposureLevel?: ExposureLevel;
  onExposureLevelChange?: (
    value: ExposureLevel | undefined
  ) => void;
  canBurn?: boolean;
  canFlood?: boolean;
  onEnvironmentChange?: (
    property: 'canBurn' | 'canFlood',
    value: boolean | undefined
  ) => void;
  onDelete?: () => void;
  showLabel?: boolean;
  onShowLabelChange?: (showLabel: boolean) => void;
}

export default function SettingsPanel({
  objectType,
  color,
  onColorChange,
  exposureLevel,
  onExposureLevelChange,
  canBurn,
  canFlood,
  onEnvironmentChange,
  onDelete,
  showLabel,
  onShowLabelChange,
}: SettingsPanelProps)
{
  const objectName =
    objectType === 'area'
      ? 'Area'
      : objectType === 'location'
        ? 'Location'
        : 'Feature';

  return (
    <div className="ruleset-interaction-panel">
      {objectType === 'area' && onExposureLevelChange && (
  <label className="ruleset-interaction-field">
    <span className="ruleset-interaction-label">
      Exposure Level
    </span>

    <select
      value={exposureLevel ?? ''}
      onChange={(event) =>
      {
        const value = event.target.value;

        onExposureLevelChange(
          value === ''
            ? undefined
            : Number(value) as ExposureLevel
        );
      }}
    >
      <option value="">Inherit from Map</option>
      <option value="0">Fully</option>
      <option value="1">Partial</option>
      <option value="2">Protected</option>
    </select>
  </label>
)}
{objectType === 'area' && onEnvironmentChange && (
  <>
    {(
      [
        ['canBurn', 'Can Burn', canBurn],
        ['canFlood', 'Can Flood', canFlood],
      ] as const
    ).map(([property, label, value]) => (
      <label
        key={property}
        className="ruleset-interaction-field"
      >
        <span className="ruleset-interaction-label">
          {label}
        </span>

        <select
          value={
            value === undefined
              ? 'inherit'
              : String(value)
          }
          onChange={(event) =>
          {
            const selection = event.target.value;

            onEnvironmentChange(
              property,
              selection === 'inherit'
                ? undefined
                : selection === 'true'
            );
          }}
        >
          <option value="inherit">
            Inherit from Map
          </option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    ))}
  </>
)}
      {objectType === 'area' &&
        color !== undefined &&
        onColorChange && (
          <label className="ruleset-interaction-field">
            <span className="ruleset-interaction-label">
              Color
            </span>

            <input
              type="color"
              aria-label="Area color"
              value={color}
              onChange={(event) =>
              {
                onColorChange(event.target.value);
              }}
            />
          </label>
        )}

      {onShowLabelChange && (
  <label className="ruleset-interaction-field">
    <span className="ruleset-interaction-label">
      Show Label
    </span>

    <input
      type="checkbox"
      checked={showLabel ?? true}
      onChange={(event) =>
      {
        onShowLabelChange(event.target.checked);
      }}
    />
  </label>
)}

      {onDelete && (
        <div className="ruleset-interaction-field">
          <span className="ruleset-interaction-label">
            Delete
          </span>

          <button
            type="button"
            onClick={onDelete}
          >
            Delete {objectName}
          </button>
        </div>
      )}
    </div>
  );
}