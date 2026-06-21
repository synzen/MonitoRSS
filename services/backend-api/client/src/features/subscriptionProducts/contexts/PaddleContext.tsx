/* eslint-disable no-continue */
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { initializePaddle, Paddle, RetainCancellationFlowResult } from "@paddle/paddle-js";
import { useNavigate } from "react-router-dom";
import { captureException } from "@sentry/react";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useDiscordUserMe, useUserMe } from "@/features/discordUser";
import { notifyError } from "@/utils/notifyError";
import { pages, getPlanDisplayName, ProductKey } from "@/constants";
import { CheckoutSummaryData } from "@/types/CheckoutSummaryData";
import { PricePreview } from "@/types/PricePreview";
import { retryPromise } from "@/utils/retryPromise";
import formatCurrency from "@/utils/formatCurrency";
import { resolveCheckoutCustomerEmail } from "../utils/resolveCheckoutCustomerEmail";

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
  updatePaymentMethod: (
    transactionId: string,
    options?: { onClose?: () => void; onCompleted?: () => void; frameTarget?: string },
  ) => void;
  updateCheckout: (data: {
    prices: Array<{
      priceId: string;
      quantity: number;
    }>;
  }) => void;
  resetCheckoutData: () => void;
  isLoaded?: boolean;
  /** Whether Paddle is configured for this instance (client token present). */
  isConfigured: boolean;
  openCheckout: (p: {
    prices: Array<{ priceId: string; quantity: number }>;
    frameTarget?: string;
    displayMode?: "inline" | "overlay";
    /** Called when the checkout overlay is closed without completing payment. */
    onClose?: () => void;
    /** Called when payment completes (checkout.completed). */
    onCompleted?: () => void;
    /**
     * Overrides the default `{ userId }` checkout custom data. Workspace
     * checkout passes `{ userId, workspaceId }` so the webhook routes the
     * subscription to the workspace instead of the personal supporter record.
     */
    customData?: Record<string, string>;
  }) => void;
  getPricePreview: (
    pricesToGet: Array<{ priceId: string; quantity: number }>,
  ) => Promise<Array<PricePreview>>;
  isSubscriptionCreated: boolean;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
  initCancellationFlow: (
    subscriptionId: string,
  ) => Promise<RetainCancellationFlowResult | undefined>;
}

export const PaddleContext = createContext<ContextProps>({
  updateCheckout: () => {},
  updatePaymentMethod: () => {},
  checkoutLoadedData: undefined,
  isLoaded: false,
  isConfigured: false,
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
  // Holds the current checkout's "closed without completing" callback. The Paddle event callback is
  // registered once at init and can't see per-open closures, so the latest one is kept in a ref.
  const checkoutClosedCallbackRef = useRef<(() => void) | undefined>(undefined);
  // Same per-open closure problem for "payment completed" (used by workspace
  // checkout, whose completion is not observable via the user's own record).
  const checkoutCompletedCallbackRef = useRef<(() => void) | undefined>(undefined);
  const checkoutCompletedRef = useRef(false);
  // The event callback is registered once at init, before the paddle state is
  // set, so closing the checkout from inside it needs the instance via a ref.
  const paddleInstanceRef = useRef<Paddle | undefined>(undefined);
  const lastCheckoutWasOverlayRef = useRef(false);
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
          checkoutCompletedRef.current = true;

          // The event carries the checkout's own custom data. A workspace id
          // marks a workspace purchase, whose completion is confirmed by the
          // workspace's Billing page; the "Provisioning benefits..." overlay
          // below waits for the user's PERSONAL record to flip to paid, which
          // never happens for a workspace checkout.
          const completedCustomData = (
            event as unknown as {
              data?: { custom_data?: { workspaceId?: string } };
            }
          ).data?.custom_data;

          if (!completedCustomData?.workspaceId) {
            setCheckForSubscriptionCreated(true);
          }

          setCheckoutLoadedData(undefined);
          checkoutCompletedCallbackRef.current?.();
          checkoutCompletedCallbackRef.current = undefined;

          // The overlay does not reliably dismiss itself after a successful
          // payment and keeps intercepting pointer events over the whole page;
          // the app shows its own confirmation state, so close it.
          if (lastCheckoutWasOverlayRef.current) {
            paddleInstanceRef.current?.Checkout.close();
          }
        } else if (event.name === "checkout.closed") {
          // Fired when the overlay is dismissed. Only treat it as a cancel if payment didn't
          // complete (Paddle also closes the overlay after a successful checkout).
          if (!checkoutCompletedRef.current) {
            checkoutClosedCallbackRef.current?.();
          }

          checkoutClosedCallbackRef.current = undefined;
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
        paddleInstanceRef.current = paddleInstance;
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

      const transactionPreview = await retryPromise(async () =>
        paddle.TransactionPreview({
          items: items.map(({ priceId, quantity }) => ({
            priceId,
            quantity,
            includeInTotals: true,
          })),
        }),
      );

      const { details, currencyCode } = transactionPreview.data;

      return {
        totalFormatted: formatCurrency(details.totals.total, currencyCode),
      };
    },
    [!!paddle],
  );

  const initCancellationFlow = useCallback(
    async (subscriptionId: string): Promise<RetainCancellationFlowResult | undefined> => {
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
              unitAmount: number;
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
            unitTotals,
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
            // Paddle returns minor-unit integers as strings; keep numeric so
            // callers can do exact per-unit arithmetic.
            unitAmount: Number(unitTotals.total),
            currencyCode,
            quantity,
          };

          const prices = pricesByProduct[useProductId]?.prices;

          if (!prices) {
            pricesByProduct[useProductId] = {
              name: getPlanDisplayName(useProductId),
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
            unitAmount: d.unitAmount,
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
    (
      transactionId: string,
      options?: { onClose?: () => void; onCompleted?: () => void; frameTarget?: string },
    ) => {
      setIsSubscriptionCreated(false);
      // Wire the same lifecycle refs as openCheckout so the shared event handler
      // fires the caller's callbacks. A frameTarget means the caller hosts the
      // checkout inline (in their own container), so it is NOT an overlay: the
      // completed handler must not call Checkout.close(), which would blank the
      // inline frame. Without a frameTarget this stays an overlay, as before.
      const inline = !!options?.frameTarget;
      checkoutCompletedRef.current = false;
      checkoutClosedCallbackRef.current = options?.onClose;
      checkoutCompletedCallbackRef.current = options?.onCompleted;
      lastCheckoutWasOverlayRef.current = !inline;

      paddle?.Checkout.open({
        transactionId,
        settings: inline
          ? {
              displayMode: "inline",
              frameTarget: options?.frameTarget,
              frameInitialHeight: 634,
              allowLogout: false,
              frameStyle:
                "width: 100%; height: 100%; min-width: 312px; min-height:634px; padding-left: 8px; padding-right: 8px;",
            }
          : {
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
      displayMode,
      onClose,
      onCompleted,
      customData,
    }: {
      prices: Array<{ priceId: string; quantity: number }>;
      frameTarget?: string;
      displayMode?: "inline" | "overlay";
      onClose?: () => void;
      onCompleted?: () => void;
      customData?: Record<string, string>;
    }) => {
      setIsSubscriptionCreated(false);
      checkoutCompletedRef.current = false;
      checkoutClosedCallbackRef.current = onClose;
      checkoutCompletedCallbackRef.current = onCompleted;
      lastCheckoutWasOverlayRef.current = displayMode === "overlay";

      // A workspace checkout is billed to the owner's verified email, a personal
      // checkout to the Discord email; either is blocked when its address is
      // missing, so route the user to set it before opening Paddle.
      const customer = resolveCheckoutCustomerEmail({
        customData,
        discordEmail: user?.result.email,
        verifiedEmail: user?.result.verifiedEmail,
      });

      if ("blocked" in customer) {
        if (customer.blocked === "verifiedEmailRequired") {
          notifyError(
            "Verify an email to subscribe",
            "Workspace billing uses your verified email. Add one in settings to continue.",
          );
        }

        navigate(pages.userSettings());

        return;
      }

      if (!paddle) {
        captureException(Error("Failed to open paddle checkout since paddle is not initialized"));
        notifyError(
          "Unable to load checkout",
          "Please try refreshing the page or using a different browser.",
        );

        return;
      }

      const useOverlay = displayMode === "overlay";

      paddle?.Checkout.open({
        items: prices.map(({ priceId, quantity }) => ({
          priceId,
          quantity,
        })),
        customer: {
          email: customer.email,
        },
        settings: useOverlay
          ? {
              displayMode: "overlay",
              theme: "dark",
              allowLogout: false,
              // Single-step checkout, matching the inline variant: payment
              // fields are present immediately instead of behind an
              // email/country first page.
              variant: "one-page",
              showAddDiscounts: false,
            }
          : {
              displayMode: "inline",
              frameTarget: frameTarget || "checkout-modal",
              frameInitialHeight: 634,
              allowLogout: false,
              variant: "one-page",
              showAddDiscounts: false,
              frameStyle:
                "width: 100%; height: 100%; min-width: 312px; min-height:634px; padding-left: 8px; padding-right: 8px;",
            },
        customData: customData ?? {
          userId: user?.result.id ?? "",
        },
      });
    },
    [user?.result.email, user?.result.verifiedEmail, user?.result.id, !!paddle],
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
      // Billing is usable only when the instance has it enabled (the backend's
      // master switch: supporters enabled and Paddle configured) AND a Paddle
      // client token is present to render checkout. A leftover client token
      // alone must not surface billing UI when billing is off (self-host).
      isConfigured: !!clientToken && !!user?.result.enableBilling,
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
      !!user?.result.enableBilling,
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
