import type { FastifyRequest, FastifyReply } from "fastify";
import {
  ApiErrorCode,
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "../../infra/error-handler";
import logger from "../../infra/logger";
import { AddressLocationNotAllowedException } from "../../shared/exceptions/paddle.exceptions";
import {
  ACCEPTED_CURRENCIES,
  type GetProductsQuery,
  type UpdatePreviewBody,
} from "./supporter-subscriptions.schemas";

interface ProductPrice {
  id: string;
  interval: "month" | "year";
  formattedPrice: string;
  currencyCode: string;
}

interface GetProductsResponse {
  data: {
    products: Array<{
      id: string;
      name: string;
      prices: ProductPrice[];
    }>;
    currencies: Array<{ code: string; symbol: string }>;
  };
}

export async function handleGetProductsHandler(
  request: FastifyRequest<{ Querystring: GetProductsQuery }>,
): Promise<GetProductsResponse> {
  const currency = (request.query.currency || "USD").toUpperCase();
  const { supporterSubscriptionsService } = request.container;

  const currencies = ACCEPTED_CURRENCIES as unknown as Array<{
    code: string;
    symbol: string;
  }>;

  try {
    const { products } =
      await supporterSubscriptionsService.getProductCurrencies(currency, {
        ipAddress: request.ip,
      });

    return {
      data: {
        products: Object.entries(products).map(([key, value]) => ({
          id: key,
          name: value.name,
          prices: value.prices.map((p) => ({
            id: p.id,
            interval: p.interval,
            formattedPrice: p.formattedPrice,
            currencyCode: p.currencyCode,
          })),
        })),
        currencies,
      },
    };
  } catch (err) {
    if (err instanceof AddressLocationNotAllowedException) {
      throw new BadRequestError(ApiErrorCode.ADDRESS_LOCATION_NOT_ALLOWED);
    }
    throw err;
  }
}

export async function handlePaddleWebhookHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ ok: number }> {
  const signature = request.headers["paddle-signature"] as string | undefined;
  const bodyBuffer = request.body as Buffer;
  const bodyString = bodyBuffer.toString("utf-8");

  let requestBody: Record<string, unknown>;
  try {
    requestBody = JSON.parse(bodyString);
  } catch {
    requestBody = {};
  }

  try {
    const { paddleWebhooksService } = request.container;

    const isValid = await paddleWebhooksService.isVerifiedWebhookEvent({
      signature,
      requestBody: bodyString,
    });

    if (!isValid) {
      logger.warn("Invalid signature received for paddle webhook event", {
        requestBody,
        signature,
      });
      throw new UnauthorizedError();
    }

    const event = requestBody as {
      event_type: string;
      data: unknown;
    };

    if (event.event_type === "subscription.canceled") {
      await paddleWebhooksService.handleSubscriptionCancelledEvent(
        event as never,
      );
    } else if (event.event_type === "subscription.updated") {
      await paddleWebhooksService.handleSubscriptionUpdatedEvent(
        event as never,
      );
    } else if (event.event_type === "subscription.activated") {
      await paddleWebhooksService.handleSubscriptionUpdatedEvent(
        event as never,
      );
    }

    return { ok: 1 };
  } catch (err) {
    logger.error("Error while handling paddle webhook event", {
      requestBody,
      signature,
      stack: (err as Error).stack,
    });
    throw err;
  }
}

export async function handleChangePaymentMethodHandler(
  request: FastifyRequest,
): Promise<{ data: { paddleTransactionId: string } }> {
  const discordUserId = request.discordUserId!;
  const { supporterSubscriptionsService } = request.container;

  const email =
    await supporterSubscriptionsService.getEmailFromDiscordUserId(
      discordUserId,
    );

  if (!email) {
    throw new BadRequestError(ApiErrorCode.INVALID_REQUEST, "No email found");
  }

  const { id } =
    await supporterSubscriptionsService.getUpdatePaymentMethodTransaction({
      discordUserId,
    });

  return {
    data: {
      paddleTransactionId: id,
    },
  };
}

export async function handleUpdatePreviewHandler(
  request: FastifyRequest<{ Body: UpdatePreviewBody }>,
): Promise<{
  data: {
    immediateTransaction: {
      billingPeriod: {
        startsAt: string;
        endsAt: string;
      };
      subtotal: string;
      subtotalFormatted: string;
      tax: string;
      taxFormatted: string;
      credit: string;
      creditFormatted: string;
      total: string;
      totalFormatted: string;
      grandTotal: string;
      grandTotalFormatted: string;
    };
  };
}> {
  const discordUserId = request.discordUserId!;
  const { priceId, prices } = request.body;
  const { supporterSubscriptionsService } = request.container;

  if (!priceId && !prices) {
    throw new BadRequestError(
      ApiErrorCode.INVALID_REQUEST,
      "Either priceId or prices must be provided",
    );
  }

  const email =
    await supporterSubscriptionsService.getEmailFromDiscordUserId(
      discordUserId,
    );

  if (!email) {
    throw new BadRequestError(ApiErrorCode.INVALID_REQUEST, "No email found");
  }

  const items: Array<{ priceId: string; quantity: number }> = prices
    ? prices.map((p) => ({ priceId: p.priceId, quantity: p.quantity }))
    : [{ priceId: priceId!, quantity: 1 }];

  const preview = await supporterSubscriptionsService.previewSubscriptionChange(
    {
      discordUserId,
      items,
    },
  );

  return { data: preview };
}

export async function handleUpdateSubscriptionHandler(
  request: FastifyRequest<{ Body: UpdatePreviewBody }>,
  reply: FastifyReply,
): Promise<void> {
  const discordUserId = request.discordUserId!;
  const { priceId, prices } = request.body;
  const { supporterSubscriptionsService } = request.container;

  if (!priceId && !prices) {
    throw new BadRequestError(
      ApiErrorCode.INVALID_REQUEST,
      "Either priceId or prices must be provided",
    );
  }

  const email =
    await supporterSubscriptionsService.getEmailFromDiscordUserId(
      discordUserId,
    );

  if (!email) {
    throw new BadRequestError(ApiErrorCode.INVALID_REQUEST, "No email found");
  }

  const items: Array<{ priceId: string; quantity: number }> = prices
    ? prices.map((p) => ({ priceId: p.priceId, quantity: p.quantity }))
    : [{ priceId: priceId!, quantity: 1 }];

  await supporterSubscriptionsService.changeSubscription({
    discordUserId,
    items,
  });

  return reply.status(204).send();
}

export async function handleCancelSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const discordUserId = request.discordUserId!;
  const { supporterSubscriptionsService } = request.container;

  const email =
    await supporterSubscriptionsService.getEmailFromDiscordUserId(
      discordUserId,
    );

  if (!email) {
    throw new BadRequestError(ApiErrorCode.INVALID_REQUEST, "No email found");
  }

  await supporterSubscriptionsService.cancelSubscription({
    discordUserId,
  });

  return reply.status(204).send();
}

export async function handleResumeSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const discordUserId = request.discordUserId!;
  const { supporterSubscriptionsService } = request.container;

  const email =
    await supporterSubscriptionsService.getEmailFromDiscordUserId(
      discordUserId,
    );

  if (!email) {
    throw new BadRequestError(ApiErrorCode.INVALID_REQUEST, "No email found");
  }

  await supporterSubscriptionsService.resumeSubscription({
    discordUserId,
  });

  return reply.status(204).send();
}
