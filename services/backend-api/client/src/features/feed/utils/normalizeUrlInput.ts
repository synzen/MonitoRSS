const HTTP_SCHEME = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

// A scheme-less host followed by a path, query, or fragment — e.g. "www.youtube.com/@channel".
// In ambiguous inputs a bare host like "example.com" is intentionally treated as a search term,
// so a path/query/fragment is required to read scheme-less input as a pasted URL.
const SCHEMELESS_URL_WITH_PATH = /^([a-z0-9-]+\.)+[a-z]{2,}[:/?#]\S*$/i;

// A host with an optional path — e.g. "example.com" or "youtu.be/abc". Used where the input is
// already known to be a URL (not a search term), so a bare host is accepted too.
const HOST_LIKE = /^([a-z0-9-]+\.)+[a-z]{2,}([:/?#]\S*)?$/i;

export interface ParsedUrlInput {
  isUrl: boolean;
  url: string;
}

export function parseSearchInputAsUrl(input: string): ParsedUrlInput {
  const trimmed = input.trim();

  if (HTTP_SCHEME.test(trimmed)) {
    return { isUrl: true, url: trimmed };
  }

  if (SCHEMELESS_URL_WITH_PATH.test(trimmed)) {
    return { isUrl: true, url: `https://${trimmed}` };
  }

  return { isUrl: false, url: trimmed };
}

export function ensureUrlScheme(input: string): string {
  const trimmed = input.trim();

  if (ANY_SCHEME.test(trimmed) || !HOST_LIKE.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}
