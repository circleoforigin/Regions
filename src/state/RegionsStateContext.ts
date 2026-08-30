import {
  createContext,
  useContext,
  type Dispatch,
} from 'react';

import type {
  RegionsSessionState,
  RegionsStateAction,
} from './RegionsState';

export interface RegionsStateContextValue {
  state: RegionsSessionState;
  dispatch: Dispatch<RegionsStateAction>;
}

export const RegionsStateContext =
  createContext<RegionsStateContextValue | null>(null);

export function useRegionsState(): RegionsStateContextValue {
  const context = useContext(RegionsStateContext);

  if (!context) {
    throw new Error(
      'useRegionsState must be used within RegionsStateProvider.'
    );
  }

  return context;
}
