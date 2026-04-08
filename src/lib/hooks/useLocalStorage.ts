'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * A generic hook that mirrors `useState` but persists the value to localStorage.
 *
 * - SSR-safe: reads localStorage only on the client via a lazy initializer.
 * - Syncs every state change back to localStorage via `useEffect`.
 * - Falls back to `initialValue` if the key doesn't exist or JSON.parse fails.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  // Lazy initializer — runs once on mount (client only)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Persist to localStorage whenever storedValue changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Storage full or blocked — silently ignore
    }
  }, [key, storedValue]);

  // Reset helper — clears this key and reverts to initialValue
  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setStoredValue, reset];
}
