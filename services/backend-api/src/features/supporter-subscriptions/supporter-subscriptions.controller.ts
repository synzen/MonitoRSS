/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  Body,
  CacheInterceptor,
  CacheTTL,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { PaddleWebhooksService } from "./paddle-webhooks.service";
import { UserAuthDetails } from "../../common";
import { UserAuth } from "../../common/decorators/user-auth.decorator";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { CreateSubscriptionPreviewInputDto } from "./dto/create-subscription-preview-input.dto";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";
import {
  PaddleEventSubscriptionActivated,
  PaddleEventSubscriptionUpdated,
} from "./types/paddle-webhook-events.type";

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
  async handlePaddleWebhook(@Body() requestBody: Record<string, any>) {
    console.log(
      "🚀 ~ file: supporter-subscriptions.controller.ts:96 ~ SupporterSubscriptionsController ~ handlePaddleWebhook ~ requestBody:",
      JSON.stringify(requestBody, null, 2)
    );

    if (requestBody.event_type === "subscription.updated") {
      await this.paddleWebhooksService.handleSubscriptionUpdatedEvent(
        requestBody as PaddleEventSubscriptionUpdated
      );
    }

    if (requestBody.event_type === "subscription.activated") {
      await this.paddleWebhooksService.handleSubscriptionUpdatedEvent(
        requestBody as PaddleEventSubscriptionActivated
      );
    }

    return {
      ok: 1,
    };
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

    const { products } =
      await this.supporterSubscriptionsService.getProductCurrencies(
        currency || "USD"
      );

    return {
      data: {
        products: Object.keys(products).map((p) => ({
          id: p,
          prices: products[p].prices.map((d) => ({
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
  @Post("update-preview")
  async previewChange(
    @UserAuth()
    { email }: UserAuthDetails,
    @Body(ValidationPipe)
    { currencyCode, priceId }: CreateSubscriptionPreviewInputDto
  ) {
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
    @UserAuth()
    { email }: UserAuthDetails,
    @Body(ValidationPipe)
    { currencyCode, priceId }: CreateSubscriptionPreviewInputDto
  ) {
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
}
