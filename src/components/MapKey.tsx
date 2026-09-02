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
  onSave,
}: MapKeyProps) {
  const [editing, setEditing] =
    useState(false);

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

    setEditing(false);
  }

  function cancel() {
    setNameDraft(mapName);
    setTypeDraft(mapTypeId ?? '');

    nameDraftRef.current =
      mapName;

    typeDraftRef.current =
      mapTypeId ?? '';

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
      {!editing ? (
        <>
          <button
            type="button"
            className="map-key-name"
            onClick={() => {
              setEditTarget('name');
              setEditing(true);
            }}
          >
            {mapName}
          </button>

          <span className="map-key-label">
            Map
          </span>

          <button
            type="button"
            className="map-key-type"
            onClick={() => {
              setEditTarget('type');
              setEditing(true);
            }}
          >
            {selectedType?.name ??
              'Select Type:'}
          </button>
        </>
      ) : (
        <div className="map-key-editor">
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
              if (
                event.key === 'Enter'
              ) {
                event.preventDefault();
                save();
              }

              if (
                event.key === 'Escape'
              ) {
                event.preventDefault();
                cancel();
              }
            }}
            autoFocus={editTarget === 'name'}
          />

          <select
            className="map-key-type-select"
            value={typeDraft}
            autoFocus={editTarget === 'type'}
            onChange={(event) => {
              const value =
                event.target.value;

              setTypeDraft(value);
              typeDraftRef.current =
                value;
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Escape'
              ) {
                event.preventDefault();
                cancel();
              }
            }}
          >
            <option value="">
              Select Type:
            </option>

            {featureTypes.map(
              (type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name}
                </option>
              )
            )}            
          </select>
        </div>
      )}
    </aside>
  );
}

export default MapKey;