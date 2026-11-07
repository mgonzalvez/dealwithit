import { createContext, useContext } from 'react';

export interface TipsContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

/**
 * Inline coaching tips shown at decision points. Toggled from the header and
 * persisted, so a confident user can turn them off for good.
 */
export const TipsContext = createContext<TipsContextValue>({
  enabled: true,
  setEnabled: () => {}
});

export function useTips(): TipsContextValue {
  return useContext(TipsContext);
}
