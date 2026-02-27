/* eslint-disable no-continue */
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { initializePaddle, Paddle, RetainCancellationFlowResult } from "@paddle/paddle-js";
import { useNavigate } from "react-router-dom";
import { captureException } from "@sentry/react";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useDiscordUserMe, useUserMe } from "../features/discordUser";
import { pages, PRODUCT_NAMES, ProductKey } from "../constants";
import { CheckoutSummaryData } from "../types/CheckoutSummaryData";
import { PricePreview } from "../types/PricePreview";
import { retryPromise } from "../utils/retryPromise";
import formatCurrency from "../utils/formatCurrency";

const pwAuth = import.meta.env.VITE_PADDLE_PW_AUTH;
const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

export interface PaddleCheckoutLoadedEvent {
  data: {
    items: Array<{
      price_id: string;
      billing_cycle: {
        interval: "month" | "year";
      };
      product: {
        id: string;
        name: string;
      };
      quantity: number;
      totals: {
        balance: number;
        credit: number;
        discount: number;
        subtotal: number;
        tax: number;
        total: number;
      };
    }>;
    currency_code: string;
    recurring_totals?: {
      balance: number;
      credit: number;
      discount: number;
      subtotal: number;
      tax: number;
      total: number;
    };
    totals: {
      balance: number;
      credit: number;
      discount: number;
      subtotal: number;
      tax: number;
      total: number;
    };
  };
}

export type PaddleCheckoutUpdatedEvent = PaddleCheckoutLoadedEvent;

interface ContextProps {
  checkoutLoadedData?: CheckoutSummaryData;
  updatePaymentMethod: (transactionId: string) => void;
  updateCheckout: (data: {
    prices: Array<{
      priceId: string;
      quantity: number;
    }>;
  }) => void;
  resetCheckoutData: () => void;
  isLoaded?: boolean;
  openCheckout: (p: {
    prices: Array<{ priceId: string; quantity: number }>;
    frameTarget?: string;
  }) => void;
  getPricePreview: (
    pricesToGet: Array<{ priceId: string; quantity: number }>,
  ) => Promise<Array<PricePreview>>;
  isSubscriptionCreated: boolean;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
  initCancellationFlow: (subscriptionId: string) => Promise<RetainCancellationFlowResult>;
}

export const PaddleContext = createContext<ContextProps>({
  updateCheckout: () => {},
  updatePaymentMethod: () => {},
  checkoutLoadedData: undefined,
  isLoaded: false,
  openCheckout: () => {},
  getPricePreview: async () => [],
  resetCheckoutData: () => {},
  isSubscriptionCreated: false,
  getChargePreview: async () => {
    throw new Error("getChargePreview is not implemented");
  },
  initCancellationFlow: async () => {
    throw new Error("initCancellationFlow is not implemented");
  },
});

export const PaddleContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [checkForSubscriptionCreated, setCheckForSubscriptionCreated] = useState(false);
  const [isSubscriptionCreated, setIsSubscriptionCreated] = useState(false);
  const { data: user } = useUserMe({ checkForSubscriptionCreated });
  const { refetch: refetchDiscordUserMe } = useDiscordUserMe();
  const navigate = useNavigate();
  const [checkoutLoadedData, setCheckoutLoadedData] = useState<CheckoutSummaryData | undefined>();
  const paidSubscriptionExists = user && user?.result.subscription.product.key !== ProductKey.Free;

  useEffect(() => {
    if (checkForSubscriptionCreated && paidSubscriptionExists) {
      refetchDiscordUserMe().finally(() => {
        setCheckForSubscriptionCreated(false);
        setIsSubscriptionCreated(true);
      });
    }
  }, [checkForSubscriptionCreated, paidSubscriptionExists]);

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
          setCheckForSubscriptionCreated(true);
          setCheckoutLoadedData(undefined);
        } else if (event.name === "checkout.error") {
          fetch("/api/v1/error-reports", {
            method: "POST",
            body: JSON.stringify({
              message: `Paddle Checkout error`,
              event,
            }),
            headers: {
              "Content-Type": "application/json",
            },
          });
        } else if (event.name === "checkout.loaded" || event.name === "checkout.updated") {
          const { data } = event as PaddleCheckoutLoadedEvent;

          setCheckoutLoadedData({
            currencyCode: data.currency_code,
            items: data.items.map((item) => ({
              priceId: item.price_id,
              productId: item.product.id,
              productName: item.product.name,
              interval: item.billing_cycle.interval,
              totals: {
                balance: item.totals.balance,
                credit: item.totals.credit,
                subtotal: item.totals.subtotal,
                tax: item.totals.tax,
                total: item.totals.total,
              },
              quantity: item.quantity,
            })),
            recurringTotals: data.recurring_totals
              ? {
                  balance: data.recurring_totals.balance,
                  credit: data.recurring_totals.credit,
                  subtotal: data.recurring_totals.subtotal,
                  tax: data.recurring_totals.tax,
                  total: data.recurring_totals.total,
                }
              : undefined,
            totals: {
              balance: data.totals.balance,
              credit: data.totals.credit,
              subtotal: data.totals.subtotal,
              tax: data.totals.tax,
              total: data.totals.total,
            },
          });
        }
      },
    }).then((paddleInstance: Paddle | undefined) => {
      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
    });
  }, []);

  const getChargePreview = useCallback(
    async (
      items: Array<{
        priceId: string;
        quantity: number;
      }>,
    ) => {
      if (!paddle) {
        throw new Error("Paddle is not initialized");
      }

      if (items.length === 0) {
        throw new Error(`Missing at least 1 item to preview charge`);
      }

      const transactionPreview = await paddle.TransactionPreview({
        items: items.map(({ priceId, quantity }) => ({ priceId, quantity, includeInTotals: true })),
      });

      const { details, currencyCode } = transactionPreview.data;

      return {
        totalFormatted: formatCurrency(details.totals.total, currencyCode),
      };
    },
    [!!paddle],
  );

  const initCancellationFlow = useCallback(
    async (subscriptionId: string): Promise<RetainCancellationFlowResult> => {
      if (!paddle) {
        throw new Error("Paddle is not initialized");
      }

      return paddle.Retain.initCancellationFlow({ subscriptionId });
    },
    [!!paddle],
  );

  const getPricePreview = useCallback(
    async (pricesToGet: Array<{ priceId: string; quantity: number }>) => {
      if (!paddle) {
        throw new Error("Paddle is not initialized");
      }

      if (pricesToGet.length === 0) {
        throw new Error(`Missing at least 1 price to preview`);
      }

      const pricesByProduct: Partial<
        Record<
          ProductKey,
          {
            name: string;
            prices: Array<{
              id: string;
              interval: "month" | "year" | "day" | "week";
              formattedPrice: string;
              currencyCode: string;
              quantity: number;
            }>;
          }
        >
      > = {};

      try {
        const previewData = await retryPromise(async () =>
          paddle.PricePreview({
            items: pricesToGet.map(({ priceId, quantity }) => ({ priceId, quantity })),
          }),
        );

        const { details, currencyCode } = previewData.data;

        for (let i = 0; i < details.lineItems.length; i += 1) {
          const {
            formattedTotals,
            product,
            price: { billingCycle, id: priceId },
            quantity,
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
            quantity,
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

        return Object.entries(pricesByProduct).map(([key, value]) => ({
          id: key as ProductKey,
          name: value.name,
          prices: value.prices.map((d) => ({
            id: d.id,
            interval: d.interval,
            formattedPrice: d.formattedPrice,
            currencyCode: d.currencyCode,
            quantity: d.quantity,
          })),
        }));
      } catch (e) {
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
          captureException(err);
        }

        throw e;
      }
    },
    [!!paddle],
  );

  const updatePaymentMethod = useCallback(
    (transactionId: string) => {
      setIsSubscriptionCreated(false);

      paddle?.Checkout.open({
        transactionId,
        settings: {
          allowLogout: false,
          theme: "dark",
          displayMode: "overlay",
        },
      });
    },
    [!!paddle],
  );

  const updateCheckout: ContextProps["updateCheckout"] = useCallback(
    ({ prices }) => {
      setIsSubscriptionCreated(false);

      if (!paddle) {
        return;
      }

      paddle.Checkout.updateItems(prices);
    },
    [!!paddle],
  );

  const openCheckout = useCallback(
    ({
      prices,
      frameTarget,
    }: {
      prices: Array<{ priceId: string; quantity: number }>;
      frameTarget?: string;
    }) => {
      setIsSubscriptionCreated(false);

      if (!user?.result.email) {
        navigate(pages.userSettings());

        return;
      }

      if (!paddle) {
        captureException(Error("Failed to open paddle checkout since paddle is not initialized"));

        return;
      }

      paddle?.Checkout.open({
        items: prices.map(({ priceId, quantity }) => ({
          priceId,
          quantity,
        })),
        customer: {
          email: user.result.email,
        },
        settings: {
          displayMode: "inline",
          frameTarget: frameTarget || "checkout-modal",
          frameInitialHeight: 634,
          allowLogout: false,
          variant: "one-page",
          showAddDiscounts: false,
          frameStyle:
            "width: 100%; height: 100%; min-width: 312px; min-height:634px; padding-left: 8px; padding-right: 8px;",
        },
        customData: {
          userId: user.result.id,
        },
      });
    },
    [user?.result.email, user?.result.id, !!paddle],
  );

  const resetCheckoutData = useCallback(() => {
    setIsSubscriptionCreated(false);
    setCheckoutLoadedData(undefined);
  }, []);

  const providerVal = useMemo(
    () => ({
      checkoutLoadedData,
      updatePaymentMethod,
      updateCheckout,
      isLoaded: !!paddle,
      openCheckout,
      getPricePreview,
      resetCheckoutData,
      isSubscriptionCreated,
      getChargePreview,
      initCancellationFlow,
    }),
    [
      JSON.stringify(checkoutLoadedData),
      !!paddle,
      updateCheckout,
      updatePaymentMethod,
      openCheckout,
      getPricePreview,
      resetCheckoutData,
      isSubscriptionCreated,
      getChargePreview,
      initCancellationFlow,
    ],
  );

  return (
    <PaddleContext.Provider value={providerVal}>
      <Box role="status" aria-live="polite" aria-atomic="true">
        {checkForSubscriptionCreated && (
          <Stack
            backdropFilter="blur(3px)"
            alignItems="center"
            justifyContent="center"
            height="100vh"
            position="absolute"
            background="blackAlpha.700"
            top={0}
            left={0}
            width="100vw"
            zIndex={10}
          >
            <Spinner />
            <Text>Provisioning benefits...</Text>
          </Stack>
        )}
      </Box>
      {children}
    </PaddleContext.Provider>
  );
};

export const usePaddleContext = () => {
  return useContext(PaddleContext);
};
