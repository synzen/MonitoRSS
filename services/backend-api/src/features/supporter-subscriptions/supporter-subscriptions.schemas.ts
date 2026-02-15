import { Type, type Static } from "@sinclair/typebox";
import { SubscriptionProductKey } from "../../services/paddle/types";

export const ACCEPTED_CURRENCIES = [
  { code: "AUD", symbol: "AU$" },
  { code: "BRL", symbol: "R$" },
  { code: "CAD", symbol: "CA$" },
  { code: "CZK", symbol: "Kč" },
  { code: "DKK", symbol: "kr." },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "HKD", symbol: "HK$" },
  { code: "HUF", symbol: "Ft" },
  { code: "MXN", symbol: "$" },
  { code: "NOK", symbol: "kr" },
  { code: "NZD", symbol: "NZ$" },
  { code: "PLN", symbol: "zł" },
  { code: "SEK", symbol: "kr" },
  { code: "SGD", symbol: "S$" },
  { code: "USD", symbol: "$" },
] as const;

export const ACCEPTED_CURRENCY_CODES = ACCEPTED_CURRENCIES.map(
  (c) => c.code,
) as string[];

export const PRODUCT_NAMES: Record<SubscriptionProductKey, string> = {
  [SubscriptionProductKey.Free]: "Free",
  [SubscriptionProductKey.Tier1]: "Tier 1",
  [SubscriptionProductKey.Tier2]: "Tier 2",
  [SubscriptionProductKey.Tier3]: "Tier 3",
  [SubscriptionProductKey.Tier3AdditionalFeed]: "Additional Feed",
};

export const SUBSCRIPTION_PRODUCT_KEYS = Object.values(SubscriptionProductKey);

const currencyPattern = ACCEPTED_CURRENCY_CODES.join("|");

export const GetProductsQuerySchema = Type.Object({
  currency: Type.Optional(
    Type.String({
      pattern: `^(${currencyPattern})$`,
      default: "USD",
    }),
  ),
});

export type GetProductsQuery = Static<typeof GetProductsQuerySchema>;

const UpdatePreviewPriceSchema = Type.Object({
  priceId: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 1 }),
});

export const UpdatePreviewBodySchema = Type.Object({
  priceId: Type.Optional(Type.String()),
  prices: Type.Optional(Type.Array(UpdatePreviewPriceSchema)),
});

export type UpdatePreviewBody = Static<typeof UpdatePreviewBodySchema>;
