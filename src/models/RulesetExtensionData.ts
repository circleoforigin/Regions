export type RulesetExtensionValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[];

export interface RulesetExtensionData {
  /*
   * Identifies the Ruleset that defined
   * this extension data.
   */
  rulesetId: string;

  /*
   * Identifies the Ruleset-owned schema
   * describing these values.
   *
   * Example:
   *   Regions.PathSegment
   */
  schemaId: string;

  /*
   * Regions persists these values but
   * does not interpret their meaning.
   */
  values: Record<
    string,
    RulesetExtensionValue
  >;
}