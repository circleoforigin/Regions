import { useEffect, useRef, useState } from 'react';

export interface GeographicTooltipState
{
  x: number;
  y: number;
  areaName?: string;
  zones: string[];
  territoryName?: string
}

export function useGeographicTooltip(delay = 500)
{
  const [tooltip, setTooltip] =
    useState<GeographicTooltipState | null>(null);

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoveredAreaRef = useRef<string | null>(null);

  function clearTimer()
  {
    if (timerRef.current !== null)
    {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function dismiss()
  {
    clearTimer();
    hoveredAreaRef.current = null;
    setTooltip(null);
  }

  function update(
    areaId: string | null,
    areaName: string | null,
    zones: { id: string; name: string }[],
    territoryName: string | null,
    x: number,
    y: number
  )
  {
    if (!areaName && zones.length === 0 && !territoryName)
    {
      dismiss();
      return;
    }

    // Every pointer movement restarts the hover delay.
    clearTimer();

    hoveredAreaRef.current = areaId;

    setTooltip(null);

    timerRef.current = setTimeout(() =>
    {
      timerRef.current = null;

      setTooltip({
        x,
        y: y - 16,
        areaName: areaName ?? undefined,
        zones: zones.map((zone) => zone.name),
        territoryName: territoryName ?? undefined,
      });
    }, delay);
  }

  useEffect(() =>
  {
    return () =>
    {
      clearTimer();
    };
  }, []);

  return {
    tooltip,
    update,
    dismiss,
  };
}