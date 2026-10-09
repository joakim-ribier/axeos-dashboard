import { useEffect, useState } from "react";

/** One of a fixed set of values, remembered across reloads. Falls back to
 * `fallback` when nothing (or a value from an older version) is stored. */
export const useStoredChoice = <T extends string>(
  storageKey: string,
  choices: readonly T[],
  fallback: T,
): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return choices.find((c) => c === raw) ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) --
      // the choice simply won't survive a refresh in that case.
    }
  }, [storageKey, value]);

  return [value, setValue];
};
