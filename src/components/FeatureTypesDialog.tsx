import { useState } from 'react';
import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';

interface FeatureTypesDialogProps {
  featureTypes: FeatureTypeDefinition[];
  onAdd: (name: string) => boolean;
  onRename: (id: string, name: string) => boolean;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function FeatureTypesDialog({
  featureTypes,
  onAdd,
  onRename,
  onDelete,
  onClose,
}: FeatureTypesDialogProps) {
  const [newName, setNewName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function addType() {
    const name = newName.trim();
    if (!name) return;
    if (!onAdd(name)) {
      setError('Feature Type names must be unique.');
      return;
    }
    setNewName('');
    setError(null);
  }

  function commitRename(type: FeatureTypeDefinition) {
    const draft = drafts[type.id];
    if (draft === undefined) return;
    const name = draft.trim();
    if (!name || !onRename(type.id, name)) {
      setDrafts((current) => ({ ...current, [type.id]: type.name }));
      setError(name ? 'Feature Type names must be unique.' : null);
      return;
    }
    setError(null);
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog feature-types-dialog">
        <h2>Feature Types</h2>

        <div className="feature-types-list">
          {featureTypes.length === 0 && (
            <div className="feature-types-empty">No Feature Types.</div>
          )}

          {featureTypes.map((type) => (
            <div className="feature-type-row" key={type.id}>
              <input
                type="text"
                value={drafts[type.id] ?? type.name}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [type.id]: event.target.value,
                }))}
                onBlur={() => commitRename(type)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key !== 'Escape') return;
                  setDrafts((current) => ({
                    ...current,
                    [type.id]: type.name,
                  }));
                  event.currentTarget.blur();
                }}
              />
              <button type="button" onClick={() => onDelete(type.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="feature-type-add-row">
          <input
            type="text"
            value={newName}
            placeholder="New Feature Type"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addType();
            }}
          />
          <button type="button" disabled={!newName.trim()} onClick={addType}>
            + Add Type
          </button>
        </div>

        {error && <div className="feature-types-error">{error}</div>}

        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default FeatureTypesDialog;
