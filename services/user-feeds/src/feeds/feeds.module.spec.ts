import { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  clearDatabase,
  DiscordMediumTestPayloadDetails,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared";
import { HttpStatus } from "@nestjs/common";
import { testConfig } from "../config/test.config";
import { FeedsModule } from "./feeds.module";
import { DiscordMediumService } from "../delivery/mediums/discord-medium.service";
import { TestDeliveryMedium } from "./constants";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { describe, it, mock, before, after, beforeEach } from "node:test";
import { deepStrictEqual } from "assert";

describe("FeedsModule", () => {
  let app: NestFastifyApplication;
  const standardHeaders = {
    "api-key": testConfig().USER_FEEDS_API_KEY,
  };
  const discordMediumService = {
    deliverTestArticle: mock.fn(),
    close: mock.fn(),
  };
  const feedFetcherService = {
    fetchFeedArticles: mock.fn(),
    fetchRandomFeedArticle: mock.fn(),
  };

  before(async () => {
    const { init, uncompiledModule } = await setupIntegrationTests({
      providers: [],
      imports: [FeedsModule],
    });

    uncompiledModule
      .overrideProvider(DiscordMediumService)
      .useValue(discordMediumService)
      .overrideProvider(FeedFetcherService)
      .useValue(feedFetcherService);

    const initialized = await init();
    app = initialized.fastifyApp;
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await teardownIntegrationTests();
  });

  describe("hello world", () => {
    it("works", () => {
      deepStrictEqual(1, 1);
    });
  });

  describe("POST /user-feeds/filter-validation", () => {
    const validPayload = {
      expression: {
        type: "article",
        value: "test",
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/filter-validation`,
        payload: validPayload,
      });

      deepStrictEqual(statusCode, HttpStatus.UNAUTHORIZED);
    });

    it("returns 200", async () => {
      const { statusCode, body } = await app.inject({
        method: "POST",
        url: `/user-feeds/filter-validation`,
        headers: standardHeaders,
        payload: validPayload,
      });

      const parsedBody = JSON.parse(body);

      deepStrictEqual(Array.isArray(parsedBody.result.errors), true);
      deepStrictEqual(statusCode, HttpStatus.OK);
    });
  });

  describe(`POST /user-feeds/get-articles`, () => {
    const validBody = {
      limit: 1,
      random: true,
      url: "https://www.google.com",
      formatter: {
        options: {
          dateFormat: "MM/DD/YYYY",
          stripImages: false,
          formatTables: true,
        },
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/get-articles`,
        payload: validBody,
      });

      deepStrictEqual(statusCode, HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 on bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/get-articles`,
        payload: {
          limit: 1,
          random: true,
        },
        headers: standardHeaders,
      });

      deepStrictEqual(statusCode, HttpStatus.BAD_REQUEST);
    });
  });

  describe(`POST /user-feeds/test`, () => {
    const mediumDetails: DiscordMediumTestPayloadDetails = {
      channel: {
        id: "channel-id",
      },
      webhook: null,
      components: [],
      content: "",
      customPlaceholders: [],
      embeds: [],
      enablePlaceholderFallback: false,
      formatter: {
        disableImageLinkPreviews: false,
        formatTables: false,
        ignoreNewLines: false,
        stripImages: false,
      },
      forumThreadTags: [],
      mentions: null,
      placeholderLimits: [],
    };
    const validPayload = {
      type: TestDeliveryMedium.Discord,
      mediumDetails,
      feed: {
        url: "https://www.google.com",
      },
    };

    it("returns 401 if unauthorized", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        payload: validPayload,
      });

      deepStrictEqual(statusCode, HttpStatus.UNAUTHORIZED);
    });

    it("returns 400 on bad payload", async () => {
      const { statusCode } = await app.inject({
        method: "POST",
        url: `/user-feeds/test`,
        headers: standardHeaders,
        payload: {
          type: "bbb",
        },
      });

      deepStrictEqual(statusCode, HttpStatus.BAD_REQUEST);
    });
  });
});
