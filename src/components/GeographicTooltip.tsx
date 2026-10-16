interface GeographicTooltipProps
{
  x: number;
  y: number;
  areaName?: string;
  zones?: string[];
  territoryName?: string;
}

export default function GeographicTooltip({
  x,
  y,
  areaName,
  zones = [],
  territoryName,
}: GeographicTooltipProps)
{
  if (
    !areaName &&
    zones.length === 0 &&
    !territoryName
  )
  {
    return null;
  }

  return (
    <div
      className="geographic-tooltip"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        zIndex: 100,
        background: 'rgba(20, 24, 32, 0.78)',
        color: '#ffffff',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        lineHeight: '1.6',
        whiteSpace: 'nowrap',
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {areaName && (
        <div>
          Area: {areaName}
        </div>
      )}

      {zones.length > 0 && (
        <div>
          Zones: {zones.join(', ')}
        </div>
      )}

      {territoryName && (
        <div>
          Territory: {territoryName}
        </div>
      )}
    </div>
  );
}