const DESCRIPTION_FIELD_PATTERNS = [
  /^description$/i,
  /^media:group__media:description$/i,
  /^summary$/i,
  /^content$/i,
  /description/i,
  /summary/i,
  /content/i,
];

const MIN_DESCRIPTION_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 10000;

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
      if (field.toLowerCase().includes("extracted")) continue;

      if (pattern.test(field) && isValidDescriptionValue(value)) {
        return field;
      }
    }
  }

  return null;
}
