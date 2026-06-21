import { ProductKey } from "../constants";

export interface PricePreview {
  id: ProductKey;
  name: string;
  prices: Array<{
    id: string;
    interval: "month" | "year" | "day" | "week";
    formattedPrice: string;
    // The per-unit price in integer minor units (e.g. cents), straight from
    // Paddle's authoritative preview. Kept alongside the formatted string so
    // callers can do exact arithmetic (e.g. base + perFeedUnit * N) without
    // parsing the localized formattedPrice. Format the result with formatCurrency.
    unitAmount: number;
    currencyCode: string;
    quantity: number;
  }>;
}
