import { useMemo } from "react";
import { MessageComponentRoot } from "../types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;

    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA).filter((k) => objA[k] != null);
  const keysB = Object.keys(objB).filter((k) => objB[k] != null);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => key in objB && deepEqual(objA[key], objB[key]));
}

export function useMessageBuilderDirty(
  messageComponent: MessageComponentRoot | undefined,
  serverMessageComponent: MessageComponentRoot | undefined
) {
  const isDirty = useMemo(
    () => !deepEqual(messageComponent, serverMessageComponent),
    [messageComponent, serverMessageComponent]
  );

  return { isDirty };
}
