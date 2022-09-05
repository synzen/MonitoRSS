import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { request } from "undici";
import {
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestServerStatusException,
} from "./exceptions";
import { FeedResponse } from "./types";

@Injectable()
export class FeedFetcherService {
  SERVICE_HOST: string;

  constructor(private readonly configService: ConfigService) {
    this.SERVICE_HOST = configService.getOrThrow("FEED_REQUEST_SERVICE_URL");
  }

  async fetch(url: string) {
    const serviceUrl = `${this.SERVICE_HOST}/requests`;
    const { statusCode, body } = await request(serviceUrl, {
      method: "POST",
      body: JSON.stringify({
        url,
      }),
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
    });

    if (statusCode < 200 || statusCode >= 300) {
      throw new FeedRequestServerStatusException(
        `Bad status code for ${serviceUrl} (${statusCode})`
      );
    }

    const response: FeedResponse = await body.json();

    const { requestStatus } = response;

    if (requestStatus === "error") {
      throw new FeedRequestInternalException(
        `Feed fetcher service encountered error while fetching feed`
      );
    }

    if (requestStatus === "parse_error") {
      throw new FeedRequestParseException(`Invalid feed`);
    }

    if (requestStatus === "pending") {
      return null;
    }

    if (requestStatus === "success") {
      return response.response.body;
    }

    throw new Error(
      `Unexpected feed request status in response: ${requestStatus}`
    );
  }
}
