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
      if (SKIP_FIELDS.includes(field)) continue;

      if (pattern.test(field) && isValidDescriptionValue(value)) {
        return field;
      }
    }
  }

  let bestField: string | null = null;
  let bestLength = MIN_DESCRIPTION_LENGTH;

  for (const [field, value] of Object.entries(articleSample)) {
    if (SKIP_FIELDS.includes(field)) continue;

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
