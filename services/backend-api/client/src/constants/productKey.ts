export enum ProductKey {
  Free = "free",
  Tier1 = "tier1",
  Tier2 = "tier2",
  Tier3 = "tier3",
  Tier3Feed = "t3feed",
}

export const PRODUCT_NAMES: Record<ProductKey, string> = {
  [ProductKey.Free]: "Free",
  [ProductKey.Tier1]: "Tier 1",
  [ProductKey.Tier2]: "Tier 2",
  [ProductKey.Tier3]: "Tier 3",
  [ProductKey.Tier3Feed]: "Tier 3 Feed",
};

export const TOP_LEVEL_PRODUCTS = [
  ProductKey.Free,
  ProductKey.Tier1,
  ProductKey.Tier2,
  ProductKey.Tier3,
];

type PriceIds = {
  month: string;
  year: string;
};

type ProductPriceIds = Record<Exclude<ProductKey, ProductKey.Free>, PriceIds>;

const SANDBOX_PRICE_IDS: ProductPriceIds = {
  [ProductKey.Tier1]: {
    month: "pri_01hf01yn08hj2jwtywq7fhsww3",
    year: "pri_01hb3g1w1snzwt3h6fgtmq142r",
  },
  [ProductKey.Tier2]: {
    month: "pri_01hb3g41n1caxys9kpzsfy98e9",
    year: "pri_01hb3g4mdqt1reaj00v5pkbghs",
  },
  [ProductKey.Tier3]: {
    month: "pri_01hbkj52vhxyayd7pdcezjvmmm",
    year: "pri_01hbkj5t7qjkj6zs0febav3139",
  },
  [ProductKey.Tier3Feed]: {
    month: "pri_01jze0h8vktx0p7pdfwr5yebfk",
    year: "pri_01jze0grrb0ykpm4azs4mx088d",
  },
};

const PRODUCTION_PRICE_IDS: ProductPriceIds = {
  [ProductKey.Tier1]: {
    month: "pri_01hb3f68thdjksrra9c9aky680",
    year: "pri_01hbnmkcspvd0nqaw5jecxagna",
  },
  [ProductKey.Tier2]: {
    month: "pri_01hbnmmra6kxk0k8c8arkqv6xf",
    year: "pri_01hbnmnb33yp8symhtn9zdvgh3",
  },
  [ProductKey.Tier3]: {
    month: "pri_01hbnmp0rzdq7jntqwsqvew3kc",
    year: "pri_01hbnmpc9zh8gyjdsx5qv0g946",
  },
  [ProductKey.Tier3Feed]: {
    month: "pri_01jzdyaa7sr427yre37j0m1h74",
    year: "pri_01jzdybc83226zq2ea8cs0csd5",
  },
};

export const PRICE_IDS: ProductPriceIds = import.meta.env.PROD
  ? PRODUCTION_PRICE_IDS
  : SANDBOX_PRICE_IDS;

export enum ProductFeature {
  Feeds = "Feeds",
  ArticleLimit = "Article Limit",
  Webhooks = "Webhooks",
  CustomPlaceholders = "Custom Placeholders",
  RefreshRate = "Refresh Rate",
  ExternalProperties = "External Properties",
}

export interface TierFeature {
  name: string;
  description: string;
  enabled?: boolean;
}

export interface TierConfig {
  productId: ProductKey;
  supportsAdditionalFeeds?: boolean;
  features: TierFeature[];
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    productId: ProductKey.Tier1,
    features: [
      { name: ProductFeature.Feeds, description: "Track 35 news feeds", enabled: true },
      {
        name: ProductFeature.ArticleLimit,
        description: "1000 articles daily per feed",
        enabled: true,
      },
      { name: ProductFeature.Webhooks, description: "Branded message delivery", enabled: true },
      {
        name: ProductFeature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      { name: ProductFeature.RefreshRate, description: "2 minute refresh rate", enabled: true },
    ],
  },
  {
    productId: ProductKey.Tier2,
    features: [
      { name: ProductFeature.Feeds, description: "Track 70 news feeds", enabled: true },
      {
        name: ProductFeature.ArticleLimit,
        description: "1000 articles daily per feed",
        enabled: true,
      },
      { name: ProductFeature.Webhooks, description: "Branded message delivery", enabled: true },
      {
        name: ProductFeature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: ProductFeature.ExternalProperties,
        description: "External properties (scrape external links)*",
        enabled: true,
      },
      { name: ProductFeature.RefreshRate, description: "2 minute refresh rate", enabled: true },
    ],
  },
  {
    productId: ProductKey.Tier3,
    supportsAdditionalFeeds: true,
    features: [
      { name: ProductFeature.Feeds, description: "Track 140 news feeds", enabled: true },
      {
        name: ProductFeature.ArticleLimit,
        description: "1000 articles daily per feed",
        enabled: true,
      },
      { name: ProductFeature.Webhooks, description: "Branded message delivery", enabled: true },
      {
        name: ProductFeature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: ProductFeature.ExternalProperties,
        description: "External properties (scrape external links)*",
        enabled: true,
      },
      { name: ProductFeature.RefreshRate, description: "2 minute refresh rate", enabled: true },
    ],
  },
];

export const findProductKeyByPriceId = (
  priceId: string,
): Exclude<ProductKey, ProductKey.Free> | null => {
  const entry = Object.entries(PRICE_IDS).find(
    ([, prices]) => prices.month === priceId || prices.year === priceId,
  );

  return entry ? (entry[0] as Exclude<ProductKey, ProductKey.Free>) : null;
};
