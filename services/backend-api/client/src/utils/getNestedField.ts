export const getNestedField = <T>(object: Record<string, any>, key: string): T | undefined => {
  const keys = key.split('.');

  if (keys.length === 1) {
    return undefined;
  }

  let result = object;

  for (let i = 0; i < keys.length; i += 1) {
    result = result?.[keys[i]];
  }

  return result as T | undefined;
};
