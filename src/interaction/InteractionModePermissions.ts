import type { InteractionMode } from './InteractionMode';

export interface InteractionModePermissions {
  canAuthorFeatures: boolean;
  canInteractWithFeatures: boolean;
  canManipulatePieces: boolean;
}

export function getInteractionModePermissions(
  mode: InteractionMode
): InteractionModePermissions {
  return {
    canAuthorFeatures: mode === 'build',
    canInteractWithFeatures:
      mode === 'explore' || mode === 'build',
    canManipulatePieces:
      mode === 'explore',
  };
}