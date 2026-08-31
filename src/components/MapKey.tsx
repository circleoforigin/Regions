interface MapKeyProps {
  mapName: string;
  side: 'left' | 'right';
}

function MapKey({ mapName, side }: MapKeyProps) {
  const sideClass = side === 'left'
    ? 'map-key map-key-left'
    : 'map-key map-key-right';

  return (
    <aside className={sideClass} aria-label="Map key">
      <div className="map-key-name">{mapName}</div>
    </aside>
  );
}

export default MapKey;
