const DESCRIPTION_FIELD_PATTERNS = [
  /^description$/i,
  /^media:group__media:description/i,
  /^summary$/i,
  /^content$/i,
  /description/i,
  /summary/i,
  /content/i,
];

const MIN_DESCRIPTION_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 10000;
const SKIP_FIELDS = ["id", "idHash", "link", "guid", "title"];
const SKIP_FIELD_PATTERNS = [/^processed::categories$/i, /^categories__\d+$/i];

function shouldSkipField(field: string): boolean {
  if (SKIP_FIELDS.includes(field)) return true;

  return SKIP_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

function isValidDescriptionValue(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;

  const trimmed = value.trim();

  if (trimmed.length < MIN_DESCRIPTION_LENGTH) return false;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (!trimmed.includes(" ")) return false;

  return true;
}

export function detectDescriptionField(articleSample: Record<string, unknown>): string | null {
  for (const pattern of DESCRIPTION_FIELD_PATTERNS) {
    for (const [field, value] of Object.entries(articleSample)) {
      if (shouldSkipField(field)) continue;

      if (pattern.test(field) && isValidDescriptionValue(value)) {
        return field;
      }
    }
  }

  let bestField: string | null = null;
  let bestLength = MIN_DESCRIPTION_LENGTH;

  for (const [field, value] of Object.entries(articleSample)) {
    if (shouldSkipField(field)) continue;

    if (isValidDescriptionValue(value)) {
      const { length } = value as string;

      if (length > bestLength) {
        bestLength = length;
        bestField = field;
      }
    }
  }

  return bestField;
}
