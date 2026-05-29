import { useEffect, useRef, useState } from "react";

// see https://github.com/tannerlinsley/react-query/issues/293
// see https://usehooks.com/useDebounce/
export function useDebounce<T>(value: T, delay: number): T;
export function useDebounce<T>(
  value: T,
  delay: number,
  options: { trackPending: true },
): { value: T; pending: boolean };

export function useDebounce<T>(
  value: T,
  delay: number,
  options?: { trackPending: boolean },
): T | { value: T; pending: boolean } {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [pending, setPending] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      return undefined;
    }

    setPending(true);

    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setPending(false);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [JSON.stringify(value), delay]);

  if (options?.trackPending) {
    return { value: debouncedValue, pending };
  }

  return debouncedValue;
}
