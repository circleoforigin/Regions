import {
  useReducer,
  type ReactNode,
} from 'react';

import {
  initialRegionsState,
  regionsStateReducer,
} from './RegionsState';
import { RegionsStateContext } from './RegionsStateContext';

interface RegionsStateProviderProps {
  children: ReactNode;
}

export function RegionsStateProvider({
  children,
}: RegionsStateProviderProps) {
  const [state, dispatch] = useReducer(
    regionsStateReducer,
    initialRegionsState
  );

  return (
    <RegionsStateContext.Provider value={{ state, dispatch }}>
      {children}
    </RegionsStateContext.Provider>
  );
}
