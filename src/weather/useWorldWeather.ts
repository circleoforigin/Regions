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
import {
  loadOrCreateWeatherFields,
  type PersistedWeatherFields,
} from './WeatherFieldRepository';
import { moduleEventBus } from '../host/ModuleBus';
import {
  createWeatherMovementCycle,
  getWeatherMovementStep,
} from './WeatherMovementCycle';
import type { WeatherEnvironmentSnapshot } from './WeatherEnvironment';
import {
  TemperatureManager,
  loadOrCreateTemperatureSwing,
} from './TemperatureManager';
import { deriveWeatherSeeds } from './WeatherSeedConfiguration';

interface WeatherCalendarEra {
  id: string;
  name: string;
  abbreviation: string;
  secondsPerMinute: number;
  minutesPerHour: number;
  hoursPerDay: number;
  dayNames: string[];
  months: {
    id: string;
    name: string;
    days: number;
  }[];
  leapRule?: {
    interval: number;
    exceptEvery?: number;
    unlessEvery?: number;
    monthId: string;
    afterDay: number;
    additionalDays: number;
  };
  startingWeekday: string;
  dateFormat: string;
}

interface WeatherSeasonAnchor {
  monthId: string;
  day: number;
  time: number;
}

interface WeatherSeasonStart
  extends WeatherSeasonAnchor {
  seasonId: string;
}

interface WeatherSeasonCalendarYear {
  year: number;
  starts: WeatherSeasonStart[];
  shortSolstice?: WeatherSeasonAnchor;
  longSolstice?: WeatherSeasonAnchor;
}

interface WeatherSeasonCalendar {
  previous: WeatherSeasonCalendarYear;
  current: WeatherSeasonCalendarYear;
  next: WeatherSeasonCalendarYear;
}

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
  temperatureManager,
  setTemperatureManager,
] = useState<TemperatureManager | null>(null);

useEffect(() => {
  let cancelled = false;

  setTemperatureManager(null);

  if (
    !projectId ||
    !worldContext ||
    !configuration ||
    resolvedProjectId !== projectId
  ) {
    return;
  }

  const seeds = deriveWeatherSeeds(
    worldContext.seed
  );

  void loadOrCreateTemperatureSwing(
    projectId,
    worldContext.worldId,
    seeds.temperature
  )
    .then(cycle => {
      if (!cancelled) {
        setTemperatureManager(
          new TemperatureManager(cycle)
        );
      }
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        console.error(
          '[Temperature] Unable to load TemperatureSwing.',
          error
        );
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

const [
  clockState,
  setClockState,
] = useState<{
  time: number;
  secondsPerDay: number;
  era: WeatherCalendarEra;
} | null>(null);

useEffect(() =>
{
let cancelled = false;
let receivedLiveClockEvent = false;

setClockState(null);

  const applyClockState = (
    payload: unknown
  ) =>
  {
    if (cancelled)
    {
      return;
    }

    const state = payload as {
      time?: number;
      era?: WeatherCalendarEra;
    } | undefined;

    const era = state?.era;

if (
  typeof state?.time !== 'number' ||
  !Number.isFinite(state.time) ||
  !era ||
  typeof era.secondsPerMinute !== 'number' ||
  typeof era.minutesPerHour !== 'number' ||
  typeof era.hoursPerDay !== 'number' ||
  !Array.isArray(era.months) ||
  era.months.length === 0
)
{
  return;
}

    const secondsPerDay =
      era.secondsPerMinute *
      era.minutesPerHour *
      era.hoursPerDay;

    if (
      !Number.isFinite(secondsPerDay) ||
      secondsPerDay <= 0
    )
    {
      return;
    }

    setClockState({
        time: state.time,
        secondsPerDay,
        era,
    });
  };

  if (!projectId)
  {
    return;
  }

const unsubscribe =
  moduleEventBus.subscribe(
    'Simulation.TimeCommitted',
    (message) =>
    {
      receivedLiveClockEvent = true;
      applyClockState(message.payload);
    }
  );

  void moduleEventBus.request(
    'Simulation.GetClockState',
    {}
  )
.then((response) =>
{
  if (
    cancelled ||
    receivedLiveClockEvent
  )
  {
    return;
  }

  applyClockState(response);
})
    .catch((error: unknown) =>
    {
      if (!cancelled)
      {
        console.error(
          '[Weather] Unable to obtain SimClock state.',
          error
        );
      }
    });

  return () =>
  {
    cancelled = true;
    unsubscribe();
  };
}, [projectId]);

const [
  seasonCalendar,
  setSeasonCalendar,
] = useState<WeatherSeasonCalendar | null>(
  null
);

useEffect(() => {
  let cancelled = false;

  setSeasonCalendar(null);

  if (!projectId || !clockState) {
    return;
  }

  void moduleEventBus.request(
    'Celestial.GetSeasonCalendar',
    {
      time: clockState.time,
      era: clockState.era,
    }
  )
    .then(response => {
      if (cancelled) {
        return;
      }

      const calendar =
        response as WeatherSeasonCalendar;

      if (
        !calendar?.current ||
        !Array.isArray(calendar.current.starts) ||
        !calendar?.previous ||
        !calendar?.next
      ) {
        throw new Error(
          'Celestial returned an invalid season calendar.'
        );
      }

      setSeasonCalendar(calendar);
    })
    .catch((error: unknown) => {
      if (!cancelled) {
        console.error(
          '[Temperature] Unable to obtain season calendar.',
          error
        );
      }
    });

  return () => {
    cancelled = true;
  };
}, [projectId, clockState]);

const [
  environment,
  setEnvironment,
] = useState<WeatherEnvironmentSnapshot | null>(
  null
);

useEffect(() =>
{
  let cancelled = false;
  let receivedLiveUpdate = false;

  setEnvironment(null);

  if (!projectId)
  {
    return;
  }

  const applyEnvironment = (
    payload: unknown
  ) =>
  {
    if (cancelled)
    {
      return;
    }

    const snapshot =
      payload as WeatherEnvironmentSnapshot | undefined;

    if (!snapshot?.definitions)
    {
      return;
    }

    setEnvironment(snapshot);
  };

  const unsubscribe =
    moduleEventBus.subscribe(
      'Environment.DefinitionsChanged',
      message =>
      {
        receivedLiveUpdate = true;
        applyEnvironment(message.payload);
      }
    );

  void moduleEventBus.request(
    'Environment.GetDefinitions',
    {}
  )
    .then(response =>
    {
      if (!receivedLiveUpdate)
      {
        applyEnvironment(response);
      }
    })
    .catch((error: unknown) =>
    {
      if (!cancelled)
      {
        console.error(
          '[Weather] Unable to obtain Environment definitions.',
          error
        );
      }
    });

  return () =>
  {
    cancelled = true;
    unsubscribe();
  };
}, [projectId]);

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

const movementStep =
  configuration && clockState
    ? getWeatherMovementStep(
        clockState.time /
          clockState.secondsPerDay,
        configuration
      )
    : null;

return {
  worldContext:
    configuration ? worldContext : null,
  configuration,
  movementCycle,
  movementStep,
  pressureField,
  windField,
  environment,
  temperatureManager,
  seasonCalendar,
  weatherFieldsLoading,
  weatherFieldsError,
};
}
