import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { useUserMe } from "../features/discordUser";

const paddleSellerId = Number(import.meta.env.VITE_PADDLE_SELLER_ID);
const pwAuth = import.meta.env.VITE_PADDLE_PW_AUTH;

interface Props {
  onCheckoutSuccess?: () => void;
}

export function usePaddleCheckout(props?: Props) {
  // Create a local state to store Paddle instance
  const [paddle, setPaddle] = useState<Paddle>();
  const { data: user } = useUserMe();

  // Download and initialize Paddle instance from CDN
  useEffect(() => {
    if (Number.isNaN(paddleSellerId)) {
      return;
    }

    initializePaddle({
      environment: import.meta.env.PROD ? "production" : "sandbox",
      seller: paddleSellerId,
      pwAuth,
      pwCustomer: {
        email: user?.result.email,
      },
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

  // Callback to open a checkout
  const openCheckout = ({ priceId }: { priceId: string }) => {
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
  };

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
  };
}
