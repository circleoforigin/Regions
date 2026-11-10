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
import {
  loadOrCreateWeatherFields,
  type PersistedWeatherFields,
} from './WeatherFieldRepository';

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


const [
  savedWeatherFields,
  setSavedWeatherFields,
] = useState<PersistedWeatherFields | null>(null);

const [
  weatherFieldsLoading,
  setWeatherFieldsLoading,
] = useState(false);

const [
  weatherFieldsError,
  setWeatherFieldsError,
] = useState<unknown>(null);

useEffect(() => {
  let cancelled = false;

  setSavedWeatherFields(null);
  setWeatherFieldsError(null);

  if (
    !projectId ||
    !worldContext ||
    !configuration ||
    resolvedProjectId !== projectId
  ) {
    setWeatherFieldsLoading(false);
    return;
  }

  setWeatherFieldsLoading(true);

  void loadOrCreateWeatherFields(
    projectId,
    worldContext.worldId,
    configuration
  )
    .then(fields => {
      if (!cancelled) {
        setSavedWeatherFields(fields);
      }
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        setWeatherFieldsError(error);

        console.error(
          '[Weather] Unable to load or save atmospheric fields.',
          error
        );
      }
    })
    .finally(() => {
      if (!cancelled) {
        setWeatherFieldsLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, [
  projectId,
  resolvedProjectId,
  worldContext,
  configuration,
]);

const pressureField = savedWeatherFields?.pressureField ?? null;
const windField = savedWeatherFields?.windField ?? null;

return {
  worldContext:
    configuration ? worldContext : null,
  configuration,
  movementCycle,
  pressureField,
  windField,
  weatherFieldsLoading,
  weatherFieldsError,
};
}
