import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { loadConsumedJokers, saveConsumedJokers, loadIgnoredJokers, saveIgnoredJokers } from './joker';
import { loadUserJokerStock, saveUserJokerStock, loadJokerStrategy, saveJokerStrategy } from './storage';
import type { RaceJokerEvaluation, JokerStrategy } from './types';

interface JokerContextType {
  consumedJokers: Record<string, boolean>;
  isConsumed: (raceKey: string) => boolean;
  toggleJoker: (raceKey: string) => boolean;
  setJoker: (raceKey: string, consumed: boolean) => void;
  clearAllJokers: () => void;
  applyJokersToRaces: (raceKeys: string[]) => void;
  autoOptimizeJokers: (
    candidates: Array<{ raceKey: string; jokerImpact?: RaceJokerEvaluation }>,
    maxAvailable: number
  ) => void;
  consumedCount: number;
  ignoredJokers: Record<string, boolean>;
  isIgnored: (raceKey: string) => boolean;
  toggleIgnoreJoker: (raceKey: string) => boolean;
  setIgnoreJoker: (raceKey: string, ignored: boolean) => void;
  clearAllIgnoredJokers: () => void;
  ignoredCount: number;
  manualStock: number;
  setManualStock: (stock: number) => void;
  strategy: JokerStrategy;
  setStrategy: (strategy: JokerStrategy) => void;
}

const JokerContext = createContext<JokerContextType | null>(null);

export function JokerProvider({ children }: { children: ReactNode }) {
  const [consumedJokers, setConsumedJokers] = useState<Record<string, boolean>>(() => {
    return loadConsumedJokers();
  });

  const [ignoredJokers, setIgnoredJokers] = useState<Record<string, boolean>>(() => {
    return loadIgnoredJokers();
  });

  const [manualStock, setManualStockState] = useState<number>(() => {
    return loadUserJokerStock();
  });

  const [strategy, setStrategyState] = useState<JokerStrategy>(() => {
    return loadJokerStrategy();
  });

  const setManualStock = useCallback((stock: number) => {
    const clamped = Math.max(0, Math.min(3, stock));
    setManualStockState(clamped);
    saveUserJokerStock(clamped);
  }, []);

  const setStrategy = useCallback((newStrategy: JokerStrategy) => {
    setStrategyState(newStrategy);
    saveJokerStrategy(newStrategy);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveConsumedJokers(consumedJokers);
  }, [consumedJokers]);

  useEffect(() => {
    saveIgnoredJokers(ignoredJokers);
  }, [ignoredJokers]);

  const isConsumed = useCallback(
    (raceKey: string) => {
      return Boolean(consumedJokers[raceKey]);
    },
    [consumedJokers]
  );

  const toggleJoker = useCallback((raceKey: string): boolean => {
    let nextState = false;
    setConsumedJokers(prev => {
      nextState = !prev[raceKey];
      const copy = { ...prev };
      if (nextState) {
        copy[raceKey] = true;
      } else {
        delete copy[raceKey];
      }
      return copy;
    });
    return nextState;
  }, []);

  const setJoker = useCallback((raceKey: string, consumed: boolean) => {
    setConsumedJokers(prev => {
      const copy = { ...prev };
      if (consumed) {
        copy[raceKey] = true;
      } else {
        delete copy[raceKey];
      }
      return copy;
    });
  }, []);

  const isIgnored = useCallback(
    (raceKey: string) => {
      return Boolean(ignoredJokers[raceKey]);
    },
    [ignoredJokers]
  );

  const toggleIgnoreJoker = useCallback((raceKey: string): boolean => {
    let nextState = false;
    setIgnoredJokers(prev => {
      nextState = !prev[raceKey];
      const copy = { ...prev };
      if (nextState) {
        copy[raceKey] = true;
      } else {
        delete copy[raceKey];
      }
      return copy;
    });
    return nextState;
  }, []);

  const setIgnoreJoker = useCallback((raceKey: string, ignored: boolean) => {
    setIgnoredJokers(prev => {
      const copy = { ...prev };
      if (ignored) {
        copy[raceKey] = true;
      } else {
        delete copy[raceKey];
      }
      return copy;
    });
  }, []);

  const clearAllIgnoredJokers = useCallback(() => {
    setIgnoredJokers({});
  }, []);

  const clearAllJokers = useCallback(() => {
    setConsumedJokers({});
  }, []);

  const applyJokersToRaces = useCallback((raceKeys: string[]) => {
    setConsumedJokers(prev => {
      const next = { ...prev };
      for (const k of raceKeys) {
        next[k] = true;
      }
      return next;
    });
  }, []);

  const autoOptimizeJokers = useCallback(
    (
      candidates: Array<{ raceKey: string; jokerImpact?: RaceJokerEvaluation }>,
      maxAvailable: number
    ) => {
      if (maxAvailable <= 0) return;
      // Sort candidates by highest score
      const sorted = [...candidates]
        .filter(c => (c.jokerImpact?.score ?? 0) >= 40)
        .sort((a, b) => (b.jokerImpact?.score ?? 0) - (a.jokerImpact?.score ?? 0))
        .slice(0, maxAvailable);

      const newMap: Record<string, boolean> = {};
      for (const item of sorted) {
        newMap[item.raceKey] = true;
      }
      setConsumedJokers(newMap);
    },
    []
  );

  const consumedCount = useMemo(() => {
    return Object.values(consumedJokers).filter(Boolean).length;
  }, [consumedJokers]);

  const ignoredCount = useMemo(() => {
    return Object.values(ignoredJokers).filter(Boolean).length;
  }, [ignoredJokers]);

  const value = useMemo(
    () => ({
      consumedJokers,
      isConsumed,
      toggleJoker,
      setJoker,
      clearAllJokers,
      applyJokersToRaces,
      autoOptimizeJokers,
      consumedCount,
      ignoredJokers,
      isIgnored,
      toggleIgnoreJoker,
      setIgnoreJoker,
      clearAllIgnoredJokers,
      ignoredCount,
      manualStock,
      setManualStock,
      strategy,
      setStrategy,
    }),
    [
      consumedJokers,
      isConsumed,
      toggleJoker,
      setJoker,
      clearAllJokers,
      applyJokersToRaces,
      autoOptimizeJokers,
      consumedCount,
      ignoredJokers,
      isIgnored,
      toggleIgnoreJoker,
      setIgnoreJoker,
      clearAllIgnoredJokers,
      ignoredCount,
      manualStock,
      setManualStock,
      strategy,
      setStrategy,
    ]
  );

  return <JokerContext.Provider value={value}>{children}</JokerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJokers(): JokerContextType {
  const ctx = useContext(JokerContext);
  if (!ctx) {
    throw new Error('useJokers must be used within a JokerProvider');
  }
  return ctx;
}
