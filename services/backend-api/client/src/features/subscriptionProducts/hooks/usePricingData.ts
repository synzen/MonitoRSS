import { useCallback, useEffect, useState } from "react";
import { captureException } from "@sentry/react";
import { usePaddleContext } from "../../../contexts/PaddleContext";
import { useUserMe } from "../../discordUser";
import { ProductKey, PRICE_IDS } from "../../../constants";
import { PricePreview } from "../../../types/PricePreview";

type BillingInterval = "month" | "year";

const getInitialInterval = (): BillingInterval =>
  (localStorage.getItem("preferredPricingInterval") as BillingInterval) || "month";

interface UsePricingDataOptions {
  isOpen: boolean;
}

export const usePricingData = ({ isOpen }: UsePricingDataOptions) => {
  const { getPricePreview, getChargePreview } = usePaddleContext();
  const { status: userStatus, error: userError, data: userData } = useUserMe();

  const [products, setProducts] = useState<PricePreview[]>();
  const [additionalFeedPricePreview, setAdditionalFeedPricePreview] = useState<PricePreview | null>(
    null
  );
  const [chargePreview, setChargePreview] = useState<string | null>(null);
  const [baseAdditionalFeedsPrice, setBaseAdditionalFeedsPrice] = useState<string | null>(null);
  const [additionalFeedsInput, setAdditionalFeedsInput] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAdditionalFeedsChange, setIsLoadingAdditionalFeedsChange] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [interval, setInterval] = useState<BillingInterval>(getInitialInterval);

  const userBillingInterval = userData?.result.subscription.billingInterval;
  const priceIdOfAdditionalFeeds = PRICE_IDS[ProductKey.Tier3Feed][interval];
  const priceIdOfTier3 = PRICE_IDS[ProductKey.Tier3][interval];

  const additionalFeedsQuantity = additionalFeedPricePreview?.prices[0]?.quantity;
  const userSubscriptionAdditionalFeeds = userData?.result.subscription.addons?.find(
    (a) => a.key === ProductKey.Tier3Feed
  )?.quantity;

  const changeInterval = useCallback((newInterval: BillingInterval) => {
    setInterval(newInterval);
    localStorage.setItem("preferredPricingInterval", newInterval);
  }, []);

  const updateAdditionalFeeds = useCallback(
    async (newQuantity: number) => {
      if (!priceIdOfAdditionalFeeds || !priceIdOfTier3) {
        return;
      }

      setIsLoadingAdditionalFeedsChange(true);

      try {
        if (newQuantity > 0) {
          const [preview, chargePreviewResult] = await Promise.all([
            getPricePreview([{ priceId: priceIdOfAdditionalFeeds, quantity: newQuantity }]),
            getChargePreview([
              { priceId: priceIdOfAdditionalFeeds, quantity: newQuantity },
              { priceId: priceIdOfTier3, quantity: 1 },
            ]),
          ]);

          const feedsPreview = preview.find((p) => p.id === ProductKey.Tier3Feed);

          if (feedsPreview) {
            setAdditionalFeedPricePreview(feedsPreview);
          }

          setChargePreview(chargePreviewResult.totalFormatted);
        } else {
          const chargePreviewResult = await getChargePreview([
            { priceId: priceIdOfTier3, quantity: 1 },
          ]);
          setChargePreview(chargePreviewResult.totalFormatted);
        }
      } finally {
        setIsLoadingAdditionalFeedsChange(false);
      }
    },
    [priceIdOfAdditionalFeeds, priceIdOfTier3, getPricePreview, getChargePreview]
  );

  const changeAdditionalFeedsInput = useCallback(
    (newQuantity: number) => {
      const clamped = Math.max(0, newQuantity);
      setAdditionalFeedsInput(clamped);
      updateAdditionalFeeds(clamped);
    },
    [updateAdditionalFeeds]
  );

  // Sync interval with user's billing interval when available
  useEffect(() => {
    if (userBillingInterval) {
      setInterval(userBillingInterval);
    }
  }, [userBillingInterval]);

  // Re-fetch additional feeds preview when interval changes
  useEffect(() => {
    updateAdditionalFeeds(additionalFeedsInput);
  }, [interval]);

  // Fetch all price data when dialog opens
  useEffect(() => {
    if (!isOpen || !userData) {
      return;
    }

    const fetchPrices = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const userAdditionalFeedsAddon = userData.result.subscription.addons?.find(
          (a) => a.key === ProductKey.Tier3Feed
        );

        if (userAdditionalFeedsAddon?.quantity != null) {
          setAdditionalFeedsInput(userAdditionalFeedsAddon.quantity);
        }

        const pricesToPreview = [
          ProductKey.Tier1,
          ProductKey.Tier2,
          ProductKey.Tier3,
          ProductKey.Tier3Feed,
        ] as const;

        const pricePreviewItems = pricesToPreview.flatMap((productKey) => {
          const prices = PRICE_IDS[productKey];
          const quantity =
            productKey === ProductKey.Tier3Feed && userAdditionalFeedsAddon
              ? userAdditionalFeedsAddon.quantity
              : 1;

          return [
            { priceId: prices.month, quantity },
            { priceId: prices.year, quantity },
          ];
        });

        const [pricePreview, totalT3ChargePreview] = await Promise.all([
          getPricePreview(pricePreviewItems),
          getChargePreview([
            {
              priceId: priceIdOfAdditionalFeeds,
              quantity: userAdditionalFeedsAddon?.quantity || 1,
            },
            { priceId: priceIdOfTier3, quantity: 1 },
          ]),
        ]);

        setChargePreview(totalT3ChargePreview.totalFormatted);
        setProducts(pricePreview);

        const t3FeedPricePreview = pricePreview.find((p) => p.id === ProductKey.Tier3Feed);

        if (t3FeedPricePreview) {
          setAdditionalFeedPricePreview(t3FeedPricePreview);
          const basePriceFormatted = t3FeedPricePreview.prices.find(
            (p) => p.interval === "month"
          )?.formattedPrice;

          if (basePriceFormatted) {
            setBaseAdditionalFeedsPrice(basePriceFormatted);
          }
        }
      } catch (err) {
        setHasError(true);
        captureException(new Error("Price preview failed to load"), { extra: { error: err } });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrices();
  }, [!!userData, isOpen]);

  const getProductPrice = useCallback(
    (productId: ProductKey) => {
      const product = products?.find((p) => p.id === productId);

      return product?.prices.find((p) => p.interval === interval);
    },
    [products, interval]
  );

  const getProduct = useCallback(
    (productId: ProductKey) => products?.find((p) => p.id === productId),
    [products]
  );

  return {
    products,
    interval,
    changeInterval,
    isLoading: isLoading || userStatus === "loading",
    isLoadingAdditionalFeedsChange,
    hasError: hasError || !!userError,
    userError,
    userData,
    userSubscription: userData?.result.subscription,
    billingPeriodEndsAt: userData?.result.subscription.billingPeriod?.end,
    additionalFeedsInput,
    changeAdditionalFeedsInput,
    additionalFeedPricePreview,
    additionalFeedsQuantity,
    userSubscriptionAdditionalFeeds,
    chargePreview,
    baseAdditionalFeedsPrice,
    priceIdOfAdditionalFeeds,
    getProductPrice,
    getProduct,
  };
};
