/* eslint-disable no-console */
/* eslint-disable no-continue */
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { useCallback, useEffect, useState } from "react";
import { useUserMe } from "../features/discordUser";
import { ProductKey } from "../constants";

const pwAuth = import.meta.env.VITE_PADDLE_PW_AUTH;
const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

interface Props {
  onCheckoutSuccess?: () => void;
  priceIds?: string[];
}

const PRODUCT_NAMES: Record<ProductKey, string> = {
  [ProductKey.Free]: "Free",
  [ProductKey.Tier1]: "Tier 1",
  [ProductKey.Tier2]: "Tier 2",
  [ProductKey.Tier3]: "Tier 3",
};

export function usePaddleCheckout(props?: Props) {
  const priceIds = props?.priceIds;
  // Create a local state to store Paddle instance
  const [paddle, setPaddle] = useState<Paddle>();
  const [pricePreviewErrored, setPricePreviewErrored] = useState(false);
  const { data: user } = useUserMe();
  const [isLoadingPricePreview, setIsLoadingPricePreview] = useState(true);
  const [pricePreview, setPricePreview] = useState<
    Array<{
      id: ProductKey;
      name: string;
      prices: Array<{
        id: string;
        interval: "month" | "year";
        formattedPrice: string;
        currencyCode: string;
      }>;
    }>
  >();

  // Download and initialize Paddle instance from CDN
  useEffect(() => {
    if (!clientToken) {
      return;
    }

    initializePaddle({
      environment: import.meta.env.PROD ? "production" : "sandbox",
      pwAuth,
      pwCustomer: {
        email: user?.result.email,
      },
      token: clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          props?.onCheckoutSuccess?.();
        }
      },
    }).then((paddleInstance: Paddle | undefined) => {
      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
    });
  }, []);

  const getPricePreview = async (priceIdsToGet: string[]) => {
    if (!paddle || !priceIdsToGet || !!pricePreview) {
      return;
    }

    const pricesByProduct: Partial<
      Record<
        ProductKey,
        {
          name: string;
          prices: Array<{
            id: string;
            interval: "month" | "year";
            formattedPrice: string;
            currencyCode: string;
          }>;
        }
      >
    > = {};

    setIsLoadingPricePreview(true);

    try {
      const previewData = await paddle.PricePreview({
        items: priceIdsToGet.map((priceId) => ({ priceId, quantity: 1 })),
      });

      const { details, currencyCode } = previewData.data;

      // const previewData.data.currencyCode
      for (let i = 0; i < details.lineItems.length; i += 1) {
        const {
          formattedTotals,
          product,
          price: { billingCycle, id: priceId },
        } = previewData.data.details.lineItems[i];
        const useProductId = product.customData?.key as ProductKey;

        if (!billingCycle || !useProductId) {
          continue;
        }

        const formattedPrice = {
          id: priceId,
          interval: billingCycle.interval,
          formattedPrice: formattedTotals.total,
          currencyCode,
        };

        const prices = pricesByProduct[useProductId]?.prices;

        if (!prices) {
          pricesByProduct[useProductId] = {
            name: PRODUCT_NAMES[useProductId],
            prices: [formattedPrice],
          };
        } else {
          prices.push(formattedPrice);
        }
      }

      setPricePreview(
        Object.entries(pricesByProduct).map(([key, value]) => ({
          id: key as ProductKey,
          name: value.name,
          prices: value.prices.map((d) => ({
            id: d.id,
            interval: d.interval,
            formattedPrice: d.formattedPrice,
            currencyCode: d.currencyCode,
          })),
        }))
      );
    } catch (e) {
      setPricePreviewErrored(true);
      console.error(e);

      try {
        await fetch("/api/v1/error-reports", {
          method: "POST",
          body: JSON.stringify({
            message: `Pricing preview API error`,
            error: e,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        console.error(err);
      }
    } finally {
      setIsLoadingPricePreview(false);
    }
  };

  useEffect(() => {
    if (!paddle || !priceIds) {
      return;
    }

    getPricePreview(priceIds.filter((p) => p.startsWith("pri_")));
  }, [JSON.stringify(priceIds)]);

  // Callback to open a checkout
  const openCheckout = useCallback(
    ({ priceId }: { priceId: string }) => {
      if (!user?.result.email) {
        return;
      }

      paddle?.Checkout.open({
        items: [{ priceId }],
        customer: {
          email: user.result.email,
        },
        settings: {
          theme: "dark",
          displayMode: "overlay",
          allowLogout: false,
        },
        customData: {
          userId: user.result.id,
        },
      });
    },
    [user?.result.email, user?.result.id]
  );

  const updatePaymentMethod = (transactionId: string) => {
    paddle?.Checkout.open({
      transactionId,
      settings: {
        allowLogout: false,
        theme: "dark",
        displayMode: "overlay",
      },
    });
  };

  return {
    isLoaded: !!paddle,
    openCheckout,
    updatePaymentMethod,
    isLoadingPricePreview,
    pricePreview,
    pricePreviewErrored,
  };
}
