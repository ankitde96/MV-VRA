"use client";

import { useCallback, useEffect, useRef } from "react";

export function useDebouncedAutosave<T>({
  delay = 400,
  onSave,
}: {
  delay?: number;
  onSave: (key: string, value: T) => Promise<boolean>;
}) {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingValues = useRef<Record<string, T>>({});

  const saveNow = useCallback(
    async (key: string, value: T) => {
      clearTimeout(timers.current[key]);
      const saved = await onSave(key, value);
      if (saved) delete pendingValues.current[key];
      return saved;
    },
    [onSave],
  );

  const schedule = useCallback(
    (key: string, value: T) => {
      pendingValues.current[key] = value;
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => void saveNow(key, value), delay);
    },
    [delay, saveNow],
  );

  const flush = useCallback(
    () =>
      Promise.all(
        Object.entries(pendingValues.current).map(([key, value]) =>
          saveNow(key, value),
        ),
      ),
    [saveNow],
  );

  useEffect(
    () => () => Object.values(timers.current).forEach(clearTimeout),
    [],
  );

  return { schedule, saveNow, flush, pendingValues };
}
