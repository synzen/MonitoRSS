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
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { useNavigate } from "react-router-dom";
import { captureException } from "@sentry/react";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useUserMe } from "../features/discordUser";
import { pages, PRODUCT_NAMES, ProductKey } from "../constants";
import { CheckoutSummaryData } from "../types/CheckoutSummaryData";
import { PricePreview } from "../types/PricePreview";
import { retryPromise } from "../utils/retryPromise";

const pwAuth = import.meta.env.VITE_PADDLE_PW_AUTH;
const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

export interface PaddleCheckoutLoadedEvent {
  data: {
    items: Array<{
      billing_cycle: {
        interval: "month" | "year";
      };
      product: {
        name: string;
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
  updateCheckout: ({ priceId }: { priceId: string }) => void;
  resetCheckoutData: () => void;
  isLoaded?: boolean;
  openCheckout: (p: { priceId: string; frameTarget?: string }) => void;
  getPricePreview: (priceIdsToGet: string[]) => Promise<Array<PricePreview>>;
  isSubscriptionCreated: boolean;
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
});

export const PaddleContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [checkForSubscriptionCreated, setCheckForSubscriptionCreated] = useState(false);
  const [isSubscriptionCreated, setIsSubscriptionCreated] = useState(false);
  const { data: user } = useUserMe({ checkForSubscriptionCreated });
  const navigate = useNavigate();
  const [checkoutLoadedData, setCheckoutLoadedData] = useState<CheckoutSummaryData | undefined>();
  const paidSubscriptionExists = user && user?.result.subscription.product.key !== ProductKey.Free;

  useEffect(() => {
    if (checkForSubscriptionCreated && paidSubscriptionExists) {
      setCheckForSubscriptionCreated(false);
      setIsSubscriptionCreated(true);
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
            item: {
              productName: data.items[0].product.name,
              interval: data.items[0].billing_cycle.interval,
            },
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

  const getPricePreview = useCallback(
    async (priceIdsToGet: string[]) => {
      if (!paddle) {
        throw new Error("Paddle is not initialized");
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
            }>;
          }
        >
      > = {};

      try {
        const previewData = await retryPromise(async () =>
          paddle.PricePreview({
            items: priceIdsToGet.map((priceId) => ({ priceId, quantity: 1 })),
          })
        );

        const { details, currencyCode } = previewData.data;

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

        return Object.entries(pricesByProduct).map(([key, value]) => ({
          id: key as ProductKey,
          name: value.name,
          prices: value.prices.map((d) => ({
            id: d.id,
            interval: d.interval,
            formattedPrice: d.formattedPrice,
            currencyCode: d.currencyCode,
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
    [!!paddle]
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
    [!!paddle]
  );

  const updateCheckout = useCallback(
    ({ priceId }: { priceId: string }) => {
      setIsSubscriptionCreated(false);

      if (!paddle) {
        return;
      }

      paddle.Checkout.updateCheckout({
        items: [{ priceId, quantity: 1 }],
      });
    },
    [!!paddle]
  );

  const openCheckout = useCallback(
    ({ priceId, frameTarget }: { priceId: string; frameTarget?: string }) => {
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
        items: [{ priceId }],
        customer: {
          email: user.result.email,
        },
        settings: {
          displayMode: "inline",
          frameTarget: frameTarget || "checkout-modal",
          frameInitialHeight: 450,
          allowLogout: false,
          variant: "one-page",
          showAddDiscounts: false,
          frameStyle:
            "width: 100%; height: 100%; min-width: 312px; min-height:550px; padding-left: 8px; padding-right: 8px;",
        },
        customData: {
          userId: user.result.id,
        },
      });
    },
    [user?.result.email, user?.result.id, !!paddle]
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
    ]
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
