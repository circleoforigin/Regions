
export interface WeatherNodePosition
{
  x: number;
  y: number;
}

export interface WeatherNode
{
  position: WeatherNodePosition;

  /**
   * Permanent pressure influence assigned
   * deterministically when the node is created.
   *
   * Normalized to the range -1 through 1.
   */
  pressureInfluence: number;
}
