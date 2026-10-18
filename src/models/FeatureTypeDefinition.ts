export type FeatureTypePropertyValue =
  | string
  | number
  | boolean;

export interface FeatureTypeDefinition {
  id: string;
  name: string;

  /*
   * Identifies the system preset
   * from which this type originated.
   *
   * Undefined for custom types.
   */
  presetId?: string;

  /*
   * Environmental and geographic
   * properties associated with
   * this Feature Type.
   *
   * Property identifiers will be
   * defined by Regions.
   */
  properties?: Record<
    string,
    FeatureTypePropertyValue
  >;
}