/**
 * useCampaign - React hook for CampaignDirector integration
 *
 * Uses useSyncExternalStore for tear-free reads of the campaign state.
 * Returns [snapshot, dispatch] tuple similar to useReducer.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { getCampaignDirector } from './CampaignDirector';
import type { CampaignCommand, CampaignSnapshot } from './types';

export function useCampaign(): [CampaignSnapshot, (cmd: CampaignCommand) => void] {
  const director = getCampaignDirector();

  const snapshot = useSyncExternalStore(
    director.subscribe,
    director.getSnapshot,
    director.getSnapshot // server snapshot (same for SSR)
  );

  const dispatch = useCallback((cmd: CampaignCommand) => director.dispatch(cmd), [director]);

  return [snapshot, dispatch];
}
