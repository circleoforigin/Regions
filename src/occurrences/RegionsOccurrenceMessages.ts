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

  areaEnter: {
    label: 'Area Enter',
    template:
      '{piece} enters {area}.',
    variables: [
      'piece',
      'area',
    ],
  },

  areaTransition: {
    label: 'Area Transition',
    template:
      '{piece} leaves {fromArea} behind and enters {toArea}.',
    variables: [
      'piece',
      'fromArea',
      'toArea',
    ],
  },

  areaExit: {
    label: 'Area Exit',
    template:
      '{piece} travels beyond the borders of {area}.',
    variables: [
      'piece',
      'area',
    ],
  },

  pathEncounter: {
    label: 'Path Encounter',
    template:
      '{piece} comes across {path}.',
    variables: [
      'piece',
      'path',
    ],
  },

  pathExitToArea: {
    label: 'Path Exit to Area',
    template:
      '{piece} leaves {path} and cuts across {area}.',
    variables: [
      'piece',
      'path',
      'area',
    ],
  },

  pathTransition: {
    label: 'Path Transition',
    template:
      '{piece} leaves {fromPath} and continues along {toPath}.',
    variables: [
      'piece',
      'fromPath',
      'toPath',
    ],
  },

  boundaryExit: {
    label: 'Boundary Exit',
    template:
      '{piece} travels beyond the borders of {location}.',
    variables: [
      'piece',
      'location',
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