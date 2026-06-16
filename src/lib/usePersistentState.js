import { useEffect, useRef, useState } from "react";
import { sharedStore } from "./sharedStore";

export function usePersistentState(key, fallback, normalize = (value) => value) {
  const fallbackRef = useRef(fallback);
  const normalizeRef = useRef(normalize);
  const [value, setValue] = useState(() => normalize(fallback));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    normalizeRef.current = normalize;
  }, [normalize]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateState() {
      try {
        const storedValue = await sharedStore.readJson(key, fallbackRef.current);

        if (!cancelled) {
          setValue(normalizeRef.current(storedValue));
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    void hydrateState();

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void sharedStore.writeJson(key, value);
  }, [isHydrated, key, value]);

  return [value, setValue, isHydrated];
}
