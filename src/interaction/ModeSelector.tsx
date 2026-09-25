import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  INTERACTION_MODES,
  type InteractionMode,
} from './InteractionMode';

interface ModeSelectorProps {
  mode: InteractionMode;
  disabled?: boolean;
  onChange: (mode: InteractionMode) => void;
}

function ModeSelector({
  mode,
  disabled = false,
  onChange,
}: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMode =
    INTERACTION_MODES.find((candidate) => {
      return candidate.id === mode;
    }) ?? INTERACTION_MODES[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutsidePointerDown(
      event: PointerEvent
    ) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown
      );
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="menu-mode-control"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {activeMode.label}{' '}
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="dropdown-menu menu-mode-dropdown">
          {INTERACTION_MODES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="dropdown-item"
              onClick={() => {
                setOpen(false);
                onChange(candidate.id);
              }}
            >
              <span className="dropdown-check">
                {candidate.id === mode ? '✓' : ''}
              </span>

              {candidate.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModeSelector;