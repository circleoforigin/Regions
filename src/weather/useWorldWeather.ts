import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getWorldSeed,
  type WorldSeedContext,
} from '../host/WorldSeedClient';
import { createWorldWeatherConfiguration } from './WeatherSeedConfiguration';
import { createWeatherMovementCycle } from './WeatherMovementCycle';
import { generateWeatherWindField } from './generation/WeatherWindGenerator';

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

  const windField =
  useMemo(() =>
  {
    if (!configuration || !worldContext)
    {
      return null;
    }

    return generateWeatherWindField(
      worldContext.seed,
      configuration
    );
  }, [
    worldContext,
    configuration,
  ]);

return {
  worldContext:
    configuration ? worldContext : null,
  configuration,
  movementCycle,
  windField,
};
}
