import { ProductKey } from "../constants";

export interface PricePreview {
  id: ProductKey;
  name: string;
  prices: Array<{
    id: string;
    interval: "month" | "year" | "day" | "week";
    formattedPrice: string;
    currencyCode: string;
  }>;
}
