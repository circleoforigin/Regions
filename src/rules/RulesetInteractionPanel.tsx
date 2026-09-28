import type {
  RulesetInteractionDefinition,
} from '@settingforge/module-sdk';

import type {
  RulesetExtensionData,
  RulesetExtensionValue,
} from '../models/RulesetExtensionData';

interface RulesetInteractionPanelProps {
  rulesetId: string;

  interaction:
    RulesetInteractionDefinition;

  value?:
    RulesetExtensionData;

  onChange: (
    value: RulesetExtensionData
  ) => void;
}

export default function RulesetInteractionPanel({
  rulesetId,
  interaction,
  value,
  onChange,
}: RulesetInteractionPanelProps) {
  const values =
    value?.rulesetId === rulesetId &&
    value.schemaId === interaction.schemaId
      ? value.values
      : {};

  const updateValue = (
    fieldId: string,
    nextValue:
      RulesetExtensionValue
  ) => {
    onChange({
      rulesetId,
      schemaId:
        interaction.schemaId,

      values: {
        ...values,
        [fieldId]: nextValue,
      },
    });
  };

  return (
    <div className="ruleset-interaction-panel">
      {interaction.fields.map(
        (field) => {
          const currentValue =
            values[field.id] ??
            field.defaultValue ??
            null;

          return (
            <label
              key={field.id}
              className="ruleset-interaction-field"
            >
              <span className="ruleset-interaction-label">
                {field.label}
              </span>

              {field.type ===
                'text' && (
                <input
                  type="text"
                  value={
                    typeof currentValue ===
                    'string'
                      ? currentValue
                      : ''
                  }
                  onChange={(event) =>
                    updateValue(
                      field.id,
                      event.target.value
                    )
                  }
                />
              )}

              {field.type ===
                'number' && (
                <input
                  type="number"
                  value={
                    typeof currentValue ===
                    'number'
                      ? currentValue
                      : ''
                  }
                  onChange={(event) => {
                    const raw =
                      event.target.value;

                    updateValue(
                      field.id,
                      raw === ''
                        ? null
                        : Number(raw)
                    );
                  }}
                />
              )}

              {field.type ===
                'boolean' && (
                <input
                  type="checkbox"
                  checked={
                    currentValue === true
                  }
                  onChange={(event) =>
                    updateValue(
                      field.id,
                      event.target.checked
                    )
                  }
                />
              )}

              {field.type ===
                'select' && (
                <select
                  value={
                    typeof currentValue ===
                    'string'
                      ? currentValue
                      : ''
                  }
                  onChange={(event) =>
                    updateValue(
                      field.id,
                      event.target.value
                    )
                  }
                >
                  {!field.required && (
                    <option value="">
                      —
                    </option>
                  )}

                  {field.options?.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              )}
            </label>
          );
        }
      )}
    </div>
  );
}