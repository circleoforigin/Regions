
import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import {
  useWorldWeather,
} from './useWorldWeather';

type WorldWeatherState =
  ReturnType<typeof useWorldWeather>;

const WeatherContext =
  createContext<WorldWeatherState | null>(
    null
  );

interface WeatherProviderProps {
  projectId: string | null;
  children: ReactNode;
}

export function WeatherProvider({
  projectId,
  children,
}: WeatherProviderProps) {
  const weather = useWorldWeather(
    projectId
  );

  return (
    <WeatherContext.Provider value={weather}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(
    WeatherContext
  );

  if (!context) {
    throw new Error(
      'useWeather must be used inside WeatherProvider.'
    );
  }

  return context;
}
