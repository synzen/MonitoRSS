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

  try {
    const url = new URL(value);

    return IMAGE_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}

export function detectImageFields(articles: Array<Record<string, unknown>>): string[] {
  if (!articles || articles.length === 0) return [];

  const selectedFields = new Set<string>();

  for (const article of articles) {
    // Group fields by their URL value within this article
    const urlToFields = new Map<string, string[]>();

    for (const [field, value] of Object.entries(article)) {
      if (field === "id" || field === "idHash") continue;

      if (isImageUrl(value)) {
        const url = value as string;
        const existing = urlToFields.get(url) || [];
        existing.push(field);
        urlToFields.set(url, existing);
      }
    }

    // For each unique URL, select the preferred field
    for (const fields of urlToFields.values()) {
      const preferredField = selectPreferredField(fields);
      selectedFields.add(preferredField);
    }
  }

  return Array.from(selectedFields).sort();
}
