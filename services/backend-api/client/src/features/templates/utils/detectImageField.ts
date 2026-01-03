const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;

function selectPreferredField(fields: string[]): string {
  const sorted = fields.sort((a, b) => {
    // Prefer shorter field names
    if (a.length !== b.length) {
      return a.length - b.length;
    }

    // Alphabetical tie-breaker for determinism
    return a.localeCompare(b);
  });

  return sorted[0];
}

function isImageUrl(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;

  const trimmed = value.trim();

  // Reject values with whitespace (indicates mixed content, not a pure URL)
  if (/\s/.test(trimmed)) return false;

  try {
    const url = new URL(trimmed);

    return IMAGE_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * Extracts a normalized key for deduplication purposes.
 * This handles cases where the same image appears with different subdomains
 * or query parameters (e.g., Reddit's preview.redd.it vs i.redd.it).
 */
function getImageDedupeKey(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Extract just the filename from the pathname
    const pathParts = url.pathname.split("/");
    const filename = pathParts[pathParts.length - 1];

    // For Reddit CDN URLs, normalize by using just the filename
    // since preview.redd.it and i.redd.it serve the same images
    if (url.hostname.endsWith("redd.it") || url.hostname.endsWith("redditmedia.com")) {
      return `reddit:${filename}`;
    }

    // For other URLs, use hostname + pathname (without query params)
    // This handles cases where the same image has different query params
    return `${url.hostname}${url.pathname}`;
  } catch {
    return urlString;
  }
}

export function detectImageFields(articles: Array<Record<string, unknown>>): string[] {
  if (!articles || articles.length === 0) return [];

  const selectedFields = new Set<string>();

  for (const article of articles) {
    // Group fields by their normalized URL key within this article
    const dedupeKeyToFields = new Map<string, string[]>();

    for (const [field, value] of Object.entries(article)) {
      if (field === "id" || field === "idHash") continue;
      if (field.includes("::anchor")) continue;

      if (isImageUrl(value)) {
        const url = value as string;
        const dedupeKey = getImageDedupeKey(url);
        const existing = dedupeKeyToFields.get(dedupeKey) || [];
        existing.push(field);
        dedupeKeyToFields.set(dedupeKey, existing);
      }
    }

    // For each unique image (by dedupe key), select the preferred field
    for (const fields of dedupeKeyToFields.values()) {
      const preferredField = selectPreferredField(fields);
      selectedFields.add(preferredField);
    }
  }

  return Array.from(selectedFields).sort();
}
