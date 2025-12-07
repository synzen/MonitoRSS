/**
 * HTTP response utilities for Bun.serve()
 */

/**
 * Create a JSON response with the given data and status code.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Parse the JSON body from a request.
 * Throws an error if the body is not valid JSON.
 */
export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Get a query parameter value from a URL.
 */
export function getQueryParam(url: URL, name: string): string | null {
  return url.searchParams.get(name);
}

/**
 * Get a required query parameter value from a URL.
 * Throws an error if the parameter is missing.
 */
export function getRequiredQueryParam(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value) {
    throw new Error(`Missing required query parameter: ${name}`);
  }
  return value;
}

/**
 * Parse an integer query parameter from a URL.
 * Throws an error if the parameter is missing or not a valid integer.
 */
export function parseIntQueryParam(url: URL, name: string): number {
  const value = getRequiredQueryParam(url, name);
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Query parameter ${name} must be an integer`);
  }
  return parsed;
}

/**
 * Parse an optional integer query parameter from a URL.
 * Returns undefined if the parameter is missing.
 * Throws an error if the parameter is present but not a valid integer.
 */
export function parseOptionalIntQueryParam(
  url: URL,
  name: string
): number | undefined {
  const value = url.searchParams.get(name);
  if (!value) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Query parameter ${name} must be an integer`);
  }
  return parsed;
}
