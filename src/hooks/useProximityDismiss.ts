import { useEffect, type RefObject } from 'react';

interface ProximityDismissOptions {
  open: boolean;
  ref: RefObject<HTMLElement | null>;
  distance?: number;
  onDismiss: () => void;
}

export function useProximityDismiss({
  open,
  ref,
  distance = 100,
  onDismiss,
}: ProximityDismissOptions) {
  useEffect(() => {
    if (!open) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const outside = event.clientX < rect.left - distance ||
        event.clientX > rect.right + distance ||
        event.clientY < rect.top - distance ||
        event.clientY > rect.bottom + distance;
      if (outside) onDismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss();
    }

    window.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [distance, onDismiss, open, ref]);
}
