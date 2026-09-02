import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  FeatureTypeDefinition,
} from '../models/FeatureTypeDefinition';

interface MapKeyProps {
  mapName: string;
  mapTypeId?: string;
  featureTypes: FeatureTypeDefinition[];
  side: 'left' | 'right';
  parentName: string;
  parentMapId?: string;
  isWorldRoot: boolean;
  parentOptions: { id: string; name: string }[];
  onParentChange: (mapId: string) => void;
  onMakeWorldRoot: () => void;

  onSave: (
    name: string,
    featureTypeId: string | undefined
  ) => void;
}

function MapKey({
  mapName,
  mapTypeId,
  featureTypes,
  side,
  parentName,
  parentMapId,
  isWorldRoot,
  parentOptions,
  onParentChange,
  onMakeWorldRoot,
  onSave,
}: MapKeyProps) {
  const [editing, setEditing] =
    useState(false);

  const [typeMenuOpen, setTypeMenuOpen] =
    useState(false);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);

  const [editTarget, setEditTarget] =
    useState<'name' | 'type'>('name');

  const [nameDraft, setNameDraft] =
    useState(mapName);

  const [typeDraft, setTypeDraft] =
    useState(mapTypeId ?? '');

  const nameDraftRef =
    useRef(nameDraft);

  const typeDraftRef =
    useRef(typeDraft);

  useEffect(() => {
    nameDraftRef.current =
      nameDraft;
  }, [nameDraft]);

  useEffect(() => {
    typeDraftRef.current =
      typeDraft;
  }, [typeDraft]);

  useEffect(() => {
    setNameDraft(mapName);
    setTypeDraft(mapTypeId ?? '');

    nameDraftRef.current =
      mapName;

    typeDraftRef.current =
      mapTypeId ?? '';

    setEditing(false);
    setParentMenuOpen(false);
  }, [
    mapName,
    mapTypeId,
  ]);

  const selectedType =
    featureTypes.find(
      (type) =>
        type.id === mapTypeId
    );

  const sideClass =
    side === 'left'
      ? 'map-key map-key-left'
      : 'map-key map-key-right';

  function save() {
    const trimmedName =
      nameDraftRef.current.trim();

    if (!trimmedName) {
      return;
    }

    onSave(
      trimmedName,
      typeDraftRef.current ||
        undefined
    );
    setTypeMenuOpen(false);
    setEditing(false);
  }

  function cancel() {
    setNameDraft(mapName);
    setTypeDraft(mapTypeId ?? '');

    nameDraftRef.current =
      mapName;

    typeDraftRef.current =
      mapTypeId ?? '';

    setTypeMenuOpen(false);
    setEditing(false);
  }  

  return (
    <aside
  className={sideClass}
  aria-label="Map key"
  onPointerDown={(event) => {
    event.stopPropagation();
  }}
  onClick={(event) => {
    event.stopPropagation();
  }}
  onBlur={(event) => {
    if (!editing) {
      return;
    }

    const nextFocused =
      event.relatedTarget as Node | null;

    if (
      nextFocused &&
      event.currentTarget.contains(
        nextFocused
      )
    ) {
      return;
    }

    save();
  }}
>
      <>
  {editing && editTarget === 'name' ? (
    <input
      className="map-key-name-input"
      type="text"
      value={nameDraft}
      onChange={(event) => {
        const value =
          event.target.value;

        setNameDraft(value);
        nameDraftRef.current =
          value;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          save();
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
      autoFocus
    />
  ) : (
    <button
      type="button"
      className="map-key-name"
      onClick={() => {
        setEditTarget('name');
        setEditing(true);
        setTypeMenuOpen(false);
      }}
    >
      {mapName}
    </button>
  )}

  <span className="map-key-label">
    Map
  </span>

  {editing && editTarget === 'type' ? (
    <div className="map-key-type-editor">
      <button
        type="button"
        className="map-key-type-toggle"
        aria-expanded={typeMenuOpen}
        autoFocus
        onClick={() => {
          setTypeMenuOpen(
            (current) => !current
          );
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      >
        {
          featureTypes.find(
            (type) =>
              type.id === typeDraft
          )?.name ??
          'Select Type:'
        }{' '}
        <span aria-hidden="true">
          ▴
        </span>
      </button>

      {typeMenuOpen && (
        <div className="map-key-type-menu">
          <button
            type="button"
            className={
              !typeDraft
                ? 'selected'
                : ''
            }
            onClick={() => {
              setTypeDraft('');
              typeDraftRef.current = '';
              setTypeMenuOpen(false);
            }}
          >
            Select Type:
          </button>

          {featureTypes.map(
            (type) => (
              <button
                key={type.id}
                type="button"
                className={
                  typeDraft === type.id
                    ? 'selected'
                    : ''
                }
                onClick={() => {
                  setTypeDraft(
                    type.id
                  );

                  typeDraftRef.current =
                    type.id;

                  setTypeMenuOpen(
                    false
                  );
                }}
              >
                {type.name}
              </button>
            )
          )}
        </div>
      )}
    </div>
  ) : (
    <button
      type="button"
      className="map-key-type"
      onClick={() => {
        setEditTarget('type');
        setEditing(true);
        setTypeMenuOpen(true);
      }}
    >
      {selectedType?.name ??
        'Select Type:'}
    </button>
  )}

  <div className="map-key-parent-row">
    {isWorldRoot ? (
      <span className="map-key-parent">Parent: World Root</span>
    ) : (
      <div className="map-key-parent-editor">
        <button
          type="button"
          className="map-key-parent"
          aria-expanded={parentMenuOpen}
          onClick={() => setParentMenuOpen((open) => !open)}
        >
          Parent: {parentName} <span aria-hidden="true">▴</span>
        </button>

        {parentMenuOpen && (
          <div className="map-key-parent-menu">
            {parentOptions.map((map) => (
              <button
                key={map.id}
                type="button"
                className={map.id === parentMapId ? 'selected' : ''}
                onClick={() => {
                  onParentChange(map.id);
                  setParentMenuOpen(false);
                }}
              >
                {map.name}
              </button>
            ))}
            <div className="map-key-parent-separator" />
            <button
              type="button"
              onClick={() => {
                setParentMenuOpen(false);
                onMakeWorldRoot();
              }}
            >
              Make World Root...
            </button>
          </div>
        )}
      </div>
    )}
  </div>
</>
    </aside>
  );
}

export default MapKey;
