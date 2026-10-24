import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';
import type { MapSimulationScale } from '../models/Map';
import type { ExposureLevel } from '../models/ExposureLevel';
import type { ActiveRulesetInteraction } from '../rules/RulesetInteraction';
import type { RulesetExtensionData } from '../models/RulesetExtensionData';
import RulesetInteractionPanel from '../rules/RulesetInteractionPanel';

function defaultCountsTowardDailyTravel(
  scale: MapSimulationScale
): boolean {
  return (
    scale === 'overworld' ||
    scale === 'area'
  );
}

interface MapKeyProps {
  mapName: string;

  rulesetInteraction: ActiveRulesetInteraction | null;
  rulesetLoading: boolean;
  rulesetData?: RulesetExtensionData;
  onRulesetDataChange: (
    value: RulesetExtensionData
  ) => void;

  onAssignMapImage: () => void;
  onCalibrateScale: () => void;
  onManageMapMediaSlots: () => void;
  mapMediaSlotsEnabled: boolean;
  simulationScale: MapSimulationScale;
  onSimulationScaleChange: (scale: MapSimulationScale) => void;
  exposureLevel: ExposureLevel;
  onExposureLevelChange: (
    value: ExposureLevel
  ) => void;
  canBurn: boolean;
  canFlood: boolean;
  onEnvironmentChange: (
    property: 'canBurn' | 'canFlood',
    value: boolean
  ) => void;
  hasDistanceScale: boolean;
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

  rulesetInteraction,
  rulesetLoading,
  rulesetData,
  onRulesetDataChange,
  onAssignMapImage,
  onCalibrateScale,
  onManageMapMediaSlots,
  mapMediaSlotsEnabled,
  simulationScale,
  onSimulationScaleChange,
  exposureLevel,
  onExposureLevelChange,
  canBurn,
  canFlood,
  onEnvironmentChange,
  hasDistanceScale,
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

  const [activeTab, setActiveTab] =
    useState<'settings' | 'ruleset' | null>(null);

  const mapKeyRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        mapKeyRef.current &&
        !mapKeyRef.current.contains(target)
      ) {
        setActiveTab(null);
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown,
      true
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true
      );
    };
  }, []);

  const rulesetOpen = activeTab === 'ruleset';
  const settingsOpen = activeTab === 'settings';

  const dailyTravelDefault =
    defaultCountsTowardDailyTravel(simulationScale);

  const dailyTravelOverride =
    rulesetData?.rulesetId === rulesetInteraction?.rulesetId &&
    rulesetData?.schemaId === rulesetInteraction?.interaction.schemaId
      ? rulesetData?.values.countsTowardDailyTravel
      : undefined;

  const countsTowardDailyTravel =
    typeof dailyTravelOverride === 'boolean'
      ? dailyTravelOverride
      : dailyTravelDefault;

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

  function selectType(typeId: string) {
    setTypeDraft(typeId);
    typeDraftRef.current = typeId;
    save();
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
  ref={mapKeyRef}
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
      <div className="map-key-tabs">
        <button
          type="button"
          className={
            settingsOpen
              ? 'map-key-tab active'
              : 'map-key-tab'
          }
          aria-expanded={settingsOpen}
          aria-controls="map-key-settings-panel"
          onClick={() => {
            setActiveTab(
              (current) =>
                current === 'settings'
                  ? null
                  : 'settings'
            );
          }}
        >
          Settings
        </button>

        <button
          type="button"
          className={
            rulesetOpen
              ? 'map-key-tab active'
              : 'map-key-tab'
          }
          aria-expanded={rulesetOpen}
          aria-controls="map-key-ruleset-panel"
          onClick={() => {
            setActiveTab(
              (current) =>
                current === 'ruleset'
                  ? null
                  : 'ruleset'
            );
          }}
        >
          Ruleset
        </button>
      </div>

      <div
        id="map-key-ruleset-panel"
        className={
          rulesetOpen
            ? 'map-key-ruleset-panel open'
            : 'map-key-ruleset-panel'
        }
        aria-hidden={!rulesetOpen}
      >
        {rulesetLoading ? (
          <div className="map-key-ruleset-heading">
            Loading Ruleset...
          </div>
        ) : rulesetInteraction ? (
          <>
          <RulesetInteractionPanel
            rulesetId={rulesetInteraction.rulesetId}
            interaction={rulesetInteraction.interaction}
value={
  rulesetInteraction
    ? {
        rulesetId: rulesetInteraction.rulesetId,
        schemaId: rulesetInteraction.interaction.schemaId,
        values: {
          ...(rulesetData?.rulesetId === rulesetInteraction.rulesetId &&
          rulesetData?.schemaId === rulesetInteraction.interaction.schemaId
            ? rulesetData.values
            : {}),
          countsTowardDailyTravel,
        },
      }
    : rulesetData
}
            onChange={onRulesetDataChange}
          />
          {typeof dailyTravelOverride === 'boolean' && (
  <button
    type="button"
    title="Remove the override and follow the map's Simulation Scale."
    onClick={() => {
      if (!rulesetInteraction || !rulesetData) {
        return;
      }

      const nextValues = {
        ...rulesetData.values,
      };

      delete nextValues.countsTowardDailyTravel;

      onRulesetDataChange({
        ...rulesetData,
        values: nextValues,
      });
    }}
  >
    Inherit Default
  </button>
)}
</>
        ) : (
          <div className="map-key-ruleset-heading">
            No Map Ruleset settings available.
          </div>
        )}
      </div>

      <div
        id="map-key-settings-panel"
        className={
          settingsOpen
            ? 'map-key-ruleset-panel open'
            : 'map-key-ruleset-panel'
        }
        aria-hidden={!settingsOpen}
      >    

        <label
          htmlFor="map-key-simulation-scale"
          className="map-key-setting-label"
        >
          Simulation Scale
        </label>

        <select
          id="map-key-simulation-scale"
          className="map-key-setting-select"
          value={simulationScale}
          onChange={(event) => {
            onSimulationScaleChange(
              event.target.value as MapSimulationScale
            );
          }}
        >
          <option value="overworld">Overworld</option>
          <option value="area">Area</option>
          <option value="local">Local</option>
          <option value="special">Special</option>
        </select>

        <label
  htmlFor="map-key-exposure-level"
  className="map-key-setting-label"
>
  Exposure Level
</label>

<select
  id="map-key-exposure-level"
  className="map-key-setting-select"
  value={exposureLevel}
  onChange={(event) =>
  {
    onExposureLevelChange(
      Number(event.target.value) as ExposureLevel
    );
  }}
>
  <option value={0}>Fully</option>
  <option value={1}>Partial</option>
  <option value={2}>Protected</option>
</select>

<label className="map-key-setting-checkbox">
  <input
    type="checkbox"
    checked={canBurn}
    onChange={(event) =>
    {
      onEnvironmentChange(
        'canBurn',
        event.target.checked
      );
    }}
  />
  Can Burn
</label>

<label className="map-key-setting-checkbox">
  <input
    type="checkbox"
    checked={canFlood}
    onChange={(event) =>
    {
      onEnvironmentChange(
        'canFlood',
        event.target.checked
      );
    }}
  />
  Can Flood
</label>

        <div className="map-key-settings-actions">
          <button
            type="button"
            onClick={onAssignMapImage}
          >
            Assign Map Image...
          </button>

          <button
            type="button"
            onClick={onCalibrateScale}
          >
            Calibrate Scale...
          </button>

          <button
            type="button"
            disabled={!mapMediaSlotsEnabled}
            onClick={onManageMapMediaSlots}
          >
            Map Media Slots...
          </button>
        </div>
      </div>

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
              selectType('');
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
                  selectType(type.id);
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

  {!hasDistanceScale && (
    <div
      className="map-key-scale-warning"
      role="status"
    >
      MAP SCALE NOT SET
    </div>
  )}
</>
    </aside>
  );
}

export default MapKey;
