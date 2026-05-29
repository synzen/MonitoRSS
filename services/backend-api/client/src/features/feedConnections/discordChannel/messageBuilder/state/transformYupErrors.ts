import type { ValidationError } from "yup";

interface FieldError {
  message: string;
  type?: string;
}

function parsePathSegments(path: string): string[] {
  const segments: string[] = [];
  let current = "";

  for (let i = 0; i < path.length; i += 1) {
    const char = path[i];

    if (char === ".") {
      if (current) segments.push(current);
      current = "";
    } else if (char === "[") {
      if (current) segments.push(current);
      current = "";
    } else if (char === "]") {
      if (current) segments.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current) segments.push(current);

  return segments;
}

export function transformYupErrors(inner: ValidationError[]): Record<string, any> {
  const errors: Record<string, any> = {};

  for (const error of inner) {
    if (!error.path) continue;

    const segments = parsePathSegments(error.path);
    let current: any = errors;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      const isNextNumeric = /^\d+$/.test(nextSegment);

      if (current[segment] === undefined || current[segment] === null) {
        current[segment] = isNextNumeric ? [] : {};
      }

      current = current[segment];
    }

    const lastSegment = segments[segments.length - 1];
    const fieldError: FieldError = { message: error.message };

    if (error.type) {
      fieldError.type = error.type;
    }

    current[lastSegment] = fieldError;
  }

  return errors;
}
