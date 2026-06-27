// Per-feed daily article allowance by plan, surfaced on the pricing dialog cards.
// Free is throttled low; every paid plan lifts the cap to the same high number
// (Personal and every Team tier share dailyArticleLimit: 1000 on the backend).
// Kept here as named constants so the buy-screen copy never hardcodes the figures.
export const FREE_DAILY_ARTICLE_LIMIT = 50;
export const PAID_DAILY_ARTICLE_LIMIT = 1000;
