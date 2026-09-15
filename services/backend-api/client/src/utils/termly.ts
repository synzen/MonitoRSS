// Termly Auto Blocker (official hosts only, see index.html) rewrites third-party
// <img src> to data-src + data-autoblocked until the visitor consents. Preview
// images render user-requested feed content, so pre-categorize them as essential.
// Manual categorization takes precedence over auto-detection per Termly docs.
export const TERMLY_ESSENTIAL_IMAGE_PROPS = {
  "data-categories": "essential",
} as const;
