import { useEffect, useState } from 'react';

/**
 * useState that is remembered in this browser (localStorage), e.g. hidden columns or a
 * collapsed panel. Falls back to the default when storage is unavailable.
 */
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: the setting just isn't remembered
    }
  }, [key, value]);

  return [value, setValue];
}
