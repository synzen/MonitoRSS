const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;

function isImageUrl(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;

  try {
    const url = new URL(value);

    return IMAGE_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}

export function detectImageField(articleSample: Record<string, unknown>): string | null {
  for (const [field, value] of Object.entries(articleSample)) {
    if (field === "id" || field === "idHash") continue;

    if (isImageUrl(value)) {
      return field;
    }
  }

  return null;
}
