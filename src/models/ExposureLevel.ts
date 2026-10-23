export type ExposureLevel = 0 | 1 | 2;

export const EXPOSURE_LEVEL_OPTIONS = [
  { value: 0, label: 'Fully' },
  { value: 1, label: 'Partial' },
  { value: 2, label: 'Protected' },
] as const;