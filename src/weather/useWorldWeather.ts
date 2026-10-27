
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getWorldSeed,
  type WorldSeedContext,
} from '../host/WorldSeedClient';

import {
  createWorldWeatherConfiguration,
} from './WeatherSeedConfiguration';

import {
  createWeatherMovementCycle,
} from './WeatherMovementCycle';

export function useWorldWeather(
  projectId: string | null
)
{
  const [
    worldContext,
    setWorldContext,
  ] = useState<WorldSeedContext | null>(
    null
  );

  const [
    resolvedProjectId,
    setResolvedProjectId,
  ] = useState<string | null>(
    null
  );

  useEffect(() =>
  {
    let cancelled = false;

    setWorldContext(null);
    setResolvedProjectId(null);

    if (!projectId)
    {
      return;
    }

    void getWorldSeed()
      .then((context) =>
      {
        if (cancelled)
        {
          return;
        }

        setWorldContext(context);
        setResolvedProjectId(projectId);
      })
      .catch((error: unknown) =>
      {
        if (!cancelled)
        {
          console.error(
            '[Weather] Unable to obtain World seed.',
            error
          );
        }
      });

    return () =>
    {
      cancelled = true;
    };
  }, [
    projectId,
  ]);

  const configuration =
    useMemo(() =>
    {
      if (
        !worldContext ||
        resolvedProjectId !== projectId
      )
      {
        return null;
      }

      return createWorldWeatherConfiguration(
        worldContext.seed
      );
    }, [
      worldContext,
      resolvedProjectId,
      projectId,
    ]);

  const movementCycle =
    useMemo(() =>
    {
      if (!configuration)
      {
        return null;
      }

      return createWeatherMovementCycle(
        configuration
      );
    }, [
      configuration,
    ]);

  return {
    worldContext:
      configuration ? worldContext : null,
    configuration,
    movementCycle,
  };
}
