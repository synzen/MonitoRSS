// Mirrors the backend SLUG_PATTERN: lowercase alphanumerics and single hyphens,
// no leading, trailing, or consecutive hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Mirrors the backend RESERVED_SLUGS set so obviously-reserved slugs are caught
// client-side before submission. The backend remains the authority.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "new",
  "create",
  "edit",
  "settings",
  "admin",
  "api",
  "me",
  "account",
  "login",
  "logout",
  "workspaces",
  "workspace",
  "feeds",
  "feed",
  "null",
  "undefined",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Derives a slug preview from a workspace name as the user types.
 * Used to pre-fill the slug field in CreateWorkspaceDialog — the user must still
 * confirm or edit it before submitting.
 */
export function slugifyPreview(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}
