export const SLUG_MAX = 50;
// Lowercase alphanumerics and single hyphens; no leading, trailing, or
// consecutive hyphens. Two-char minimum is allowed by the second branch.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Slugs that would collide with existing or likely-future literal route
// segments under /workspaces (e.g. /workspaces/new). Reserving them keeps
// user-chosen slugs from shadowing app routes.
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

export function isValidSlug(slug: string): boolean {
  return (
    SLUG_PATTERN.test(slug) &&
    slug.length >= 2 &&
    slug.length <= SLUG_MAX &&
    !RESERVED_SLUGS.has(slug)
  );
}
