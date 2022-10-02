export const getNestedField = <T>(object: Record<string, any>, key: string): T | undefined => {
  // Check if object is an actual JSON object
  if (typeof object !== 'object' || Array.isArray(object)) {
    return undefined;
  }

  const keys = key.split('.');

  let result = object;

  for (let i = 0; i < keys.length; i += 1) {
    result = result?.[keys[i]];
  }

  return result as T | undefined;
};
