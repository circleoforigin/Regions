import { useCallback, useState } from 'react';
import type { InteractionMode } from './InteractionMode';

export function useInteractionMode() {
  const [interactionMode, setInteractionModeState] =
    useState<InteractionMode>('explore');

  const setInteractionMode = useCallback(
    (mode: InteractionMode) => {
      setInteractionModeState(mode);
    },
    []
  );

  const resetInteractionMode = useCallback(() => {
    setInteractionModeState('explore');
  }, []);

  return {
    interactionMode,
    setInteractionMode,
    resetInteractionMode,
  };
}