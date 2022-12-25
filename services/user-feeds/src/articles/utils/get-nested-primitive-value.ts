import { ARTICLE_FIELD_DELIMITER } from "../constants";
import dayjs from "dayjs";
import objectPath from "object-path";

/**
 * Get a nested value with an accessor string where the fields are separated with the delimiter
 * __.
 */
export const getNestedPrimitiveValue = (
  object: Record<string, unknown>,
  accessor: string
): string | null => {
  const fields = accessor.split(ARTICLE_FIELD_DELIMITER);

  const value = objectPath.get(object, fields);

  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    return null;
  }

  if (value.constructor.name === "Object") {
    return null;
  }

  if (value instanceof Date) {
    const date = dayjs(value);

    if (date.isValid()) {
      return date.toISOString();
    }

    return null;
  }

  return String(value);
};
