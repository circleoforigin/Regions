interface SettingsPanelProps
{
  objectType: 'feature' | 'location' | 'area';
  color?: string;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  showLabel?: boolean;
  onShowLabelChange?: (showLabel: boolean) => void;
}

export default function SettingsPanel({
  objectType,
  color,
  onColorChange,
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