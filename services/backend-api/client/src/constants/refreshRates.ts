// Feed check cadence by plan, surfaced on the pricing dialog cards. Free is
// throttled to a slow cycle; every paid plan checks far more often. The value is
// the whole user-facing sentence (no formatting at the call site), so the
// constant is the sentence. Mirrors dailyArticleLimits.ts.
export const FREE_REFRESH_LABEL = "Feeds checked every 20 minutes";
export const PAID_REFRESH_LABEL = "Feeds checked every 2 minutes";
