export type ExploreSelectionAction =
  | { type: 'select'; id: string }
  | { type: 'dismiss' }
  | { type: 'none' };

export type ExploreMouseButton =
  | 'left'
  | 'right';

export function resolveExploreSelection(
  button: ExploreMouseButton,
  targetAreaId: string | null,
  selectedId: string | null,
  hasOpenDialog: boolean
): ExploreSelectionAction
{
  if (button === 'left')
  {
    if (hasOpenDialog)
    {
      return { type: 'dismiss' };
    }

    return targetAreaId
      ? {
          type: 'select',
          id: targetAreaId,
        }
      : { type: 'none' };
  }

  if (!targetAreaId)
  {
    return hasOpenDialog
      ? { type: 'dismiss' }
      : { type: 'none' };
  }

  if (targetAreaId === selectedId)
  {
    return { type: 'dismiss' };
  }

  return {
    type: 'select',
    id: targetAreaId,
  };
}