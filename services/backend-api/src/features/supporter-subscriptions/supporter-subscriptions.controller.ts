import {
  BadRequestException,
  CacheInterceptor,
  CacheTTL,
  Controller,
  Get,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";

type ProductId = string;

const ACCEPTED_CURRENCIES = [
  "AUD",
  "BRL",
  "GBP",
  "CAD",
  "CZK",
  "DKK",
  "EUR",
  "HKD",
  "HUF",
  "MXN",
  "NZD",
  "NOK",
  "PLN",
  "SGD",
  "SEK",
  "USD",
];

@Controller("supporter-subscriptions")
export class SupporterSubscriptionsController {
  constructor(
    private readonly supporterSubscriptionsService: SupporterSubscriptionsService
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60 * 5)
  async getProducts(@Query("currency") currency?: string): Promise<{
    data: Array<{
      id: ProductId;
      prices: Array<{
        interval: "month" | "year";
        formattedPrice: string;
        currencyCode: string;
      }>;
    }>;
  }> {
    if (!ACCEPTED_CURRENCIES.includes(currency || "USD")) {
      throw new BadRequestException(
        `Invalid currency code ${currency}. Must be one of ${ACCEPTED_CURRENCIES.join(
          ", "
        )}`
      );
    }

    const { products } =
      await this.supporterSubscriptionsService.getProductCurrencies(
        currency || "USD"
      );

    return {
      data: Object.keys(products).map((p) => ({
        id: p,
        prices: products[p].prices.map((d) => ({
          interval: d.interval,
          formattedPrice: d.formattedPrice,
          currencyCode: d.currencyCode,
        })),
      })),
    };
  }
}
