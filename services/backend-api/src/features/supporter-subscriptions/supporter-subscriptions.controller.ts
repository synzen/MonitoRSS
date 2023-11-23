/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  Body,
  CacheInterceptor,
  CacheTTL,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { PaddleWebhooksService } from "./paddle-webhooks.service";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { CreateSubscriptionPreviewInputDto } from "./dto/create-subscription-preview-input.dto";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";
import {
  PaddleEventSubscriptionActivated,
  PaddleEventSubscriptionCanceled,
  PaddleEventSubscriptionUpdated,
} from "./types/paddle-webhook-events.type";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import logger from "../../utils/logger";

type ProductId = string;

const ACCEPTED_CURRENCIES = [
  {
    code: "AUD",
    symbol: "AU$",
  },
  {
    code: "BRL",
    symbol: "R$",
  },
  {
    code: "GBP",
    symbol: "£",
  },
  {
    code: "CAD",
    symbol: "CA$",
  },
  {
    code: "CZK",
    symbol: "Kč",
  },
  {
    code: "DKK",
    symbol: "kr.",
  },
  {
    code: "EUR",
    symbol: "€",
  },
  {
    code: "HKD",
    symbol: "HK$",
  },
  {
    code: "HUF",
    symbol: "Ft",
  },
  {
    code: "MXN",
    symbol: "$",
  },
  {
    code: "NZD",
    symbol: "NZ$",
  },
  {
    code: "NOK",
    symbol: "kr",
  },
  {
    code: "PLN",
    symbol: "zł",
  },
  {
    code: "SGD",
    symbol: "S$",
  },
  {
    code: "SEK",
    symbol: "kr",
  },
  {
    code: "USD",
    symbol: "$",
  },
].sort((a, b) => a.code.localeCompare(b.code));

const ACCEPTED_CURRENCY_CODES = ACCEPTED_CURRENCIES.map((d) => d.code);

@Controller("subscription-products")
export class SupporterSubscriptionsController {
  constructor(
    private readonly supporterSubscriptionsService: SupporterSubscriptionsService,
    private readonly paddleWebhooksService: PaddleWebhooksService
  ) {}

  @Post("paddle-webhook")
  async handlePaddleWebhook(
    @Body() requestBody: Record<string, any>,
    @Headers("Paddle-Signature") signature?: string
  ) {
    try {
      if (
        !this.paddleWebhooksService.isVerifiedWebhookEvent({
          signature,
          requestBody: JSON.stringify(requestBody),
        })
      ) {
        logger.warn("Invalid signature received for paddle webhook event", {
          requestBody,
          signature,
        });

        throw new UnauthorizedException();
      }

      if (requestBody.event_type === "subscription.canceled") {
        await this.paddleWebhooksService.handleSubscriptionCancelledEvent(
          requestBody as PaddleEventSubscriptionCanceled
        );
      } else if (requestBody.event_type === "subscription.updated") {
        await this.paddleWebhooksService.handleSubscriptionUpdatedEvent(
          requestBody as PaddleEventSubscriptionUpdated
        );
      } else if (requestBody.event_type === "subscription.activated") {
        await this.paddleWebhooksService.handleSubscriptionUpdatedEvent(
          requestBody as PaddleEventSubscriptionActivated
        );
      }

      return {
        ok: 1,
      };
    } catch (err) {
      logger.error("Error while handling paddle webhook event", {
        requestBody,
        signature,
      });

      throw err;
    }
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60 * 5)
  async getProducts(@Query("currency") currency?: string): Promise<{
    data: {
      products: Array<{
        id: ProductId;
        prices: Array<{
          id: string;
          interval: "month" | "year";
          formattedPrice: string;
          currencyCode: string;
        }>;
      }>;
      currencies: Array<{
        code: string;
        symbol: string;
      }>;
    };
  }> {
    if (!ACCEPTED_CURRENCY_CODES.includes(currency || "USD")) {
      throw new BadRequestException(
        `Invalid currency code ${currency}. Must be one of ${ACCEPTED_CURRENCY_CODES.join(
          ", "
        )}`
      );
    }

    const useCurrency = currency || "USD";

    const { products } =
      await this.supporterSubscriptionsService.getProductCurrencies(
        useCurrency
      );

    return {
      data: {
        products: Object.entries(products).map(([key, value]) => ({
          id: key,
          name: value.name,
          prices: value.prices.map((d) => ({
            id: d.id,
            interval: d.interval,
            formattedPrice: d.formattedPrice,
            currencyCode: d.currencyCode,
          })),
        })),
        currencies: ACCEPTED_CURRENCIES,
      },
    };
  }

  @UseGuards(DiscordOAuth2Guard)
  @Get("update-preview")
  async previewChange(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @NestedQuery(ValidationPipe)
    { currencyCode, priceId }: CreateSubscriptionPreviewInputDto
  ) {
    const email =
      await this.supporterSubscriptionsService.getEmailFromDiscordUserId(
        discordUserId
      );

    if (!email) {
      throw new BadRequestException("No email found");
    }

    const preview =
      await this.supporterSubscriptionsService.previewSubscriptionChange({
        email,
        items: [
          {
            priceId: priceId,
            quantity: 1,
          },
        ],
        currencyCode,
      });

    return {
      data: preview,
    };
  }

  @UseGuards(DiscordOAuth2Guard)
  @Post("update")
  @HttpCode(HttpStatus.NO_CONTENT)
  async uppdateSubscription(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Body(ValidationPipe)
    { currencyCode, priceId }: CreateSubscriptionPreviewInputDto
  ) {
    const email =
      await this.supporterSubscriptionsService.getEmailFromDiscordUserId(
        discordUserId
      );

    if (!email) {
      throw new BadRequestException("No email found");
    }

    await this.supporterSubscriptionsService.changeSubscription({
      email,
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      currencyCode,
    });
  }

  @UseGuards(DiscordOAuth2Guard)
  @Get("cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelSubscription(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const email =
      await this.supporterSubscriptionsService.getEmailFromDiscordUserId(
        discordUserId
      );

    if (!email) {
      throw new BadRequestException("No email found");
    }

    await this.supporterSubscriptionsService.cancelSubscription({
      email,
    });
  }

  @UseGuards(DiscordOAuth2Guard)
  @Get("resume")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resumeSubscription(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken
  ) {
    const email =
      await this.supporterSubscriptionsService.getEmailFromDiscordUserId(
        discordUserId
      );

    if (!email) {
      throw new BadRequestException("No email found");
    }

    await this.supporterSubscriptionsService.resumeSubscription({
      email,
    });
  }
}
