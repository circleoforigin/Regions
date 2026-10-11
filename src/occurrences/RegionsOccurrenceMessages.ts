export interface RegionsOccurrenceMessageDefinition
{
  label: string;
  template: string;
  variables: readonly string[];
}

export const REGIONS_OCCURRENCE_MESSAGES = {
  locationArrival: {
    label: 'Location Arrival',
    template:
      '{piece} arrives at {location}.',
    variables: [
      'piece',
      'location',
    ],
  },

  routeEnd: {
    label: 'Route End',
    template:
      '{piece} reaches the end of its Route.',
    variables: [
      'piece',
    ],
  },
} as const satisfies Record<
  string,
  RegionsOccurrenceMessageDefinition
>;

export type RegionsOccurrenceMessageKey =
  keyof typeof REGIONS_OCCURRENCE_MESSAGES;

export function formatRegionsOccurrenceMessage(
  key: RegionsOccurrenceMessageKey,
  values: Record<string, string>
): string
{
  const definition =
    REGIONS_OCCURRENCE_MESSAGES[key];

  return definition.template.replace(
    /\{([^}]+)\}/g,
    (placeholder, variable: string) =>
      values[variable] ?? placeholder
  );
}