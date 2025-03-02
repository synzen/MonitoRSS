// eslint-disable-next-line import/no-extraneous-dependencies
import { delay, HttpResponse, http } from "msw";
import {
  GetDiscordAuthStatusOutput,
  GetDiscordBotOutput,
  GetDiscordMeOutput,
  GetDiscordUserOutput,
  GetUserMeOutput,
  UpdateUserMeOutput,
} from "@/features/discordUser";
import { GetServersOutput } from "../features/discordServers/api/getServer";
import {
  CloneFeedOutput,
  CreateFeedSubscriberOutput,
  CreateServerLegacyFeedBulkConversionOutput,
  CreateUserFeedDatePreviewOutput,
  CreateUserFeedInput,
  CreateUserFeedLegacyRestoreOutput,
  CreateUserFeedManagementInviteOutput,
  CreateUserFeedManualRequestOutput,
  CreateUserFeedOutput,
  DeleteUserFeedsInput,
  DeleteUserFeedsOutput,
  FeedSummary,
  GetFeedArticlesOutput,
  GetFeedOutput,
  GetFeedsOutput,
  GetFeedSubscribersOutput,
  GetLegacyFeedCountOutput,
  GetServerLegacyFeedBulkConversionOutput,
  GetUserFeedArticlePropertiesOutput,
  GetUserFeedArticlesOutput,
  GetUserFeedDeliveryLogsOutput,
  GetUserFeedManagementInvitesCountOutput,
  GetUserFeedManagementInvitesOutput,
  GetUserFeedOutput,
  GetUserFeedsOutput,
  UpdateFeedSubscriberOutput,
  UpdateUserFeedOutput,
  UserFeedArticleRequestStatus,
  UserFeedHealthStatus,
} from "../features/feed";
import mockDiscordServers from "./data/discordServers";
import mockFeeds from "./data/feed";
import mockFeedArticles from "./data/feedArticles";
import mockDiscordUserMe from "./data/discordUserMe";
import {
  GetServerActiveThreadsOutput,
  GetServerChannelsOutput,
  GetServerMembersOutput,
  GetServerRolesOutput,
  GetServerSettingsOutput,
  GetServerStatusOutput,
  UpdateServerSettingsOutput,
} from "@/features/discordServers";
import mockDiscordChannels from "./data/discordChannels";
import mockDiscordRoles from "./data/discordRoles";
import mockFeedSubscribers from "./data/feedSubscribers";
import { GetDiscordWebhooksOutput } from "@/features/discordWebhooks";
import mockDiscordWebhooks from "./data/discordWebhooks";
import { generateMockApiErrorResponse } from "./generateMockApiErrorResponse";
import mockDiscordBot from "./data/discordBot";
import {
  CreateDiscordChannelConnectionCloneOutput,
  CreateDiscordChannelConnectionOutput,
  CreateDiscordChannelConnectionPreviewOutput,
  CreateDiscordChannelConnectionTestArticleOutput,
  UpdateDiscordChannelConnectionOutput,
} from "../features/feedConnections";
import { mockFeedChannelConnections } from "./data/feedConnection";
import mockUserFeeds from "./data/userFeeds";
import mockFeedSummaries from "./data/feeds";
import { mockSendTestArticleResult } from "./data/testArticleResult";
import { mockUserFeedArticles } from "./data/userFeedArticles";
import { GetUserFeedRequestsOutput } from "../features/feed/api/getUserFeedRequests";
import { mockUserFeedRequests } from "./data/userFeedRequests";
import { mockCreatePreviewResult } from "./data/createPreview";
import mockDiscordThreads from "./data/discordThreads";
import mockDiscordServerMembers from "./data/discordServerMembers";
import mockDiscordUser from "./data/discordUser";
import mockUserFeedSummary from "./data/userFeedSummary";
import { legacyFeedBulkConversion } from "./data/legacyFeedBulkConversion";
import { UserFeedManagerStatus } from "../constants";
import mockUserFeedManagementInvites from "./data/userFeedManagementInvites";
import mockUserMe from "./data/userMe";
import {
  GetSubscriptionChangePreviewOutput,
  GetSubscriptionProductsOutput,
} from "../features/subscriptionProducts";
import { mockUserFeedDeliveryLogs } from "./data/userFeedDeliveryLogs";
import {
  CreateUserFeedUrlValidationInput,
  CreateUserFeedUrlValidationOutput,
} from "../features/feed/api/createUserFeedUrlValidation";
import { ApiErrorCode } from "../utils/getStandardErrorCodeMessage copy";
import {
  CreateUserFeedDeduplicatedUrlsInput,
  CreateUserFeedDeduplicatedUrlsOutput,
} from "../features/feed/api/createUserFeedDeduplicatedUrls";

const handlers = [
  http.get("/api/v1/subscription-products/update-preview", async () => {
    await delay(500);

    return HttpResponse.json<GetSubscriptionChangePreviewOutput>({
      data: {
        immediateTransaction: {
          billingPeriod: {
            startsAt: new Date(2020, 1, 1).toISOString(),
            endsAt: new Date(2021, 2, 1).toISOString(),
          },
          subtotalFormatted: `$${(Math.random() * 100).toFixed(2)}`,
          taxFormatted: `$${(Math.random() * 100).toFixed(2)}`,
          creditFormatted: `$${(Math.random() * 100).toFixed(2)}`,
          credit: `${(Math.random() * 100).toFixed(2)}`,
          totalFormatted: `$${(Math.random() * 100).toFixed(2)}`,
          grandTotalFormatted: `$${(Math.random() * 100).toFixed(2)}`,
        },
      },
    });
  }),
  http.post("/api/v1/subscription-products/update", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),
  http.get("/api/v1/subscription-products/cancel", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),
  http.get("/api/v1/subscription-products", async ({ request }) => {
    const url = new URL(request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";

    await delay(500);

    return HttpResponse.json<GetSubscriptionProductsOutput>({
      data: {
        products: [
          {
            id: "free",
            name: "Free",
            prices: [
              {
                interval: "month",
                formattedPrice: "$0",
                currencyCode,
                id: "f0",
              },
              {
                interval: "year",
                formattedPrice: "$0",
                currencyCode,
                id: "f1",
              },
            ],
          },
          {
            id: "tier1",
            name: "Tier 1",
            prices: [
              {
                interval: "month",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p1",
              },
              {
                interval: "year",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p2",
              },
            ],
          },
          {
            id: "tier2",
            name: "Tier 2",
            prices: [
              {
                interval: "month",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p3",
              },
              {
                interval: "year",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p4",
              },
            ],
          },
          {
            id: "tier3",
            name: "Tier 3",
            prices: [
              {
                interval: "month",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p5",
              },
              {
                interval: "year",
                formattedPrice: `$${(Math.random() * 100).toFixed(2)}`,
                currencyCode,
                id: "p6",
              },
            ],
          },
        ],
        currencies: [
          { code: "USD", symbol: "$" },
          {
            code: "EUR",
            symbol: "€",
          },
        ],
      },
    });
  }),
  http.post("/api/v1/error-reports", async () => {
    await delay(500);

    return HttpResponse.json(
      {},
      {
        status: 204,
      }
    );
  }),
  http.get("/api/v1/users/@me", async () => {
    await delay(500);

    return HttpResponse.json<GetUserMeOutput>({ result: mockUserMe });
  }),
  http.patch("/api/v1/users/@me", async () => {
    await delay(500);

    return HttpResponse.json<UpdateUserMeOutput>({ result: mockUserMe });
  }),
  http.get("/api/v1/discord-users/bot", async () =>
    HttpResponse.json<GetDiscordBotOutput>({
      result: mockDiscordBot,
    })
  ),
  http.get("/api/v1/discord-users/@me", async () =>
    HttpResponse.json<GetDiscordMeOutput>(mockDiscordUserMe)
  ),

  http.get("/api/v1/discord-users/:id", async () => {
    await delay(500);

    return HttpResponse.json<GetDiscordUserOutput>({
      result: mockDiscordUser,
    });
  }),

  http.get("/api/v1/discord-users/@me/auth-status", async () =>
    HttpResponse.json<GetDiscordAuthStatusOutput>({
      authenticated: true,
    })
  ),

  http.patch(
    "/api/v1/discord-users/@me/supporter",
    async () =>
      new HttpResponse(null, {
        status: 204,
      })
  ),

  http.get("/api/v1/discord-users/@me/servers", async () =>
    HttpResponse.json<GetServersOutput>({
      total: mockDiscordServers.length,
      results: mockDiscordServers,
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/status", async () =>
    HttpResponse.json<GetServerStatusOutput>({
      result: {
        authorized: true,
      },
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/legacy-conversion", async () => {
    await delay(500);

    return HttpResponse.json<GetServerLegacyFeedBulkConversionOutput>(legacyFeedBulkConversion);
  }),

  http.post("/api/v1/discord-servers/:serverId/legacy-conversion", async () => {
    if (legacyFeedBulkConversion.status !== "IN_PROGRESS") {
      legacyFeedBulkConversion.status = "IN_PROGRESS";
    } else {
      legacyFeedBulkConversion.status = "COMPLETED";
      legacyFeedBulkConversion.failedFeeds = [];
    }

    await delay(500);

    return HttpResponse.json<CreateServerLegacyFeedBulkConversionOutput>({
      total: 5,
    });
  }),
  http.get("/api/v1/discord-servers/:serverId", async () =>
    HttpResponse.json<GetServerSettingsOutput>({
      result: {
        profile: {
          dateFormat: "YYYY-MM-DD",
          dateLanguage: "en",
          timezone: "UTC",
        },
        includesBot: true,
      },
    })
  ),

  http.patch("/api/v1/discord-servers/:serverId", async () =>
    HttpResponse.json<UpdateServerSettingsOutput>({
      result: {
        profile: {
          dateFormat: "YYYY-MM-DD",
          dateLanguage: "en",
          timezone: "UTC",
        },
      },
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/legacy-feed-count", async () => {
    await delay(700);

    return HttpResponse.json<GetLegacyFeedCountOutput>({
      result: {
        total: 5,
      },
    });
  }),

  http.get("/api/v1/discord-servers/:serverId/feeds", async ({ request }) => {
    const url = new URL(request.url);

    const limit = Number(url.searchParams.get("limit") || "10");
    const offset = Number(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search");

    const theseMockSummariesTotal = mockFeedSummaries.length * 5;
    const theseMockSummaries: FeedSummary[] = new Array(theseMockSummariesTotal)
      .fill(0)
      .map((_, i) => ({
        ...mockFeedSummaries[i % mockFeedSummaries.length],
        id: i.toString(),
      }))
      .filter((feed) =>
        !search
          ? true
          : feed.title.toLowerCase().includes(search) || feed.url.toLowerCase().includes(search)
      );

    const results = theseMockSummaries.slice(offset, offset + limit);

    await delay(700);

    return HttpResponse.json<GetFeedsOutput>({
      total: theseMockSummariesTotal,
      results,
    });
  }),

  http.get("/api/v1/discord-servers/:serverId/active-threads", async () =>
    HttpResponse.json<GetServerActiveThreadsOutput>({
      total: mockDiscordThreads.length,
      results: mockDiscordThreads,
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/channels", () =>
    HttpResponse.json<GetServerChannelsOutput>({
      total: mockDiscordChannels.length,
      results: mockDiscordChannels,
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/roles", () =>
    HttpResponse.json<GetServerRolesOutput>({
      total: mockDiscordRoles.length,
      results: mockDiscordRoles,
    })
  ),

  http.get("/api/v1/discord-servers/:serverId/members", () =>
    HttpResponse.json<GetServerMembersOutput>({
      total: mockDiscordServerMembers.length,
      results: mockDiscordServerMembers,
    })
  ),

  http.get("/api/v1/discord-webhooks", () =>
    HttpResponse.json<GetDiscordWebhooksOutput>({
      results: mockDiscordWebhooks,
    })
  ),

  http.post("/api/v1/feeds", () =>
    HttpResponse.json(
      generateMockApiErrorResponse({
        code: "WEBHOOKS_MANAGE_MISSING_PERMISSIONS",
      }),
      {
        status: 403,
      }
    )
  ),

  http.get("/api/v1/user-feed-management-invites/pending", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedManagementInvitesCountOutput>({
      total: mockUserFeedManagementInvites.length,
    });
  }),

  http.get("/api/v1/user-feed-management-invites", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedManagementInvitesOutput>({
      results: mockUserFeedManagementInvites,
    });
  }),

  http.post("/api/v1/user-feed-management-invites", async ({ request }) => {
    const body = await request.json();
    const { feedId, discordUserId } = body as { feedId: string; discordUserId: string };

    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      await delay(500);

      return HttpResponse.json(
        generateMockApiErrorResponse({
          code: "FEED_NOT_FOUND",
        }),
        {
          status: 404,
        }
      );
    }

    if (!feed.shareManageOptions) {
      feed.shareManageOptions = {
        invites: [],
      };
    }

    feed.shareManageOptions?.invites.push({
      id: Math.random().toString(),
      createdAt: new Date().toISOString(),
      discordUserId,
      status: UserFeedManagerStatus.Pending,
    });

    await delay(500);

    return HttpResponse.json<CreateUserFeedManagementInviteOutput>({
      result: {
        status: "success",
      },
    });
  }),

  http.patch("/api/v1/user-feed-management-invites/:id/status", async ({ params }) => {
    const { id } = params;

    mockUserFeedManagementInvites.splice(
      mockUserFeedManagementInvites.findIndex((u) => u.id === id),
      1
    );

    await delay(500);

    return new HttpResponse(null, {
      status: 404,
    });
  }),

  http.post("/api/v1/user-feed-management-invites/:id/resend", async ({ params }) => {
    const { id } = params;

    const matchedFeed = mockUserFeeds.find((f) =>
      f.shareManageOptions?.invites.find((u) => u.id === id)
    );

    if (!matchedFeed) {
      await delay(500);

      return HttpResponse.json(
        {},
        {
          status: 404,
        }
      );
    }

    matchedFeed.shareManageOptions!.invites.find((u) => u.id === id)!.status =
      UserFeedManagerStatus.Pending;

    await delay(500);

    return new HttpResponse(null, {
      status: 404,
    });
  }),

  http.delete("/api/v1/user-feed-management-invites/:id", async ({ params }) => {
    const { id } = params;
    const matchedFeed = mockUserFeeds.find((f) =>
      f.shareManageOptions?.invites.find((u) => u.id === id)
    );

    if (!matchedFeed) {
      await delay(500);

      return HttpResponse.json(
        {},
        {
          status: 404,
        }
      );
    }

    matchedFeed.shareManageOptions?.invites.splice(
      matchedFeed.shareManageOptions?.invites.findIndex((u) => u.id === id),
      1
    );

    await delay(500);

    return new HttpResponse(null, {
      status: 404,
    });
  }),

  http.get("/api/v1/user-feeds", async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "10");
    const offset = Number(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search");
    const disabledCodes = url.searchParams.get("filters[disabledCodes]")?.split(",");

    const filtered = mockUserFeedSummary
      .filter((feed) => (search ? feed.title.toLowerCase().includes(search) : true))
      .filter((feed) => {
        if (!disabledCodes) {
          return true;
        }

        if (disabledCodes.includes("") && !feed.disabledCode) {
          return true;
        }

        if (feed.disabledCode && disabledCodes.includes(feed.disabledCode)) {
          return true;
        }

        return false;
      });

    const limitedResults = filtered.slice(offset, offset + limit).map((feed) => ({
      ...feed,
      ownedByUser: Math.random() > 0.5,
    }));

    await delay(500);

    return HttpResponse.json<GetUserFeedsOutput>({
      results: limitedResults,
      total: filtered.length,
    });
  }),

  http.post("/api/v1/user-feeds/:id/date-preview", async () => {
    await delay(500);

    return HttpResponse.json<CreateUserFeedDatePreviewOutput>({
      result: {
        valid: true,
        output: "some date",
      },
    });
  }),

  http.post("/api/v1/user-feeds/:id/manual-request", async () => {
    await delay(500);

    return HttpResponse.json<CreateUserFeedManualRequestOutput>({
      result: {
        requestStatus: UserFeedArticleRequestStatus.BadStatusCode,
        requestStatusCode: 404,
      },
    });
  }),

  http.post("/api/v1/user-feeds/:id/restore-to-legacy", async () => {
    await delay(500);

    return HttpResponse.json<CreateUserFeedLegacyRestoreOutput>({
      result: {
        status: "success",
      },
    });
  }),

  http.patch("/api/v1/user-feeds", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.op === "bulk-delete") {
      const castedBody = body.data as DeleteUserFeedsInput["data"];
      const feedIdsToDelete = castedBody.feeds.map((f) => f.id);

      for (let i = mockUserFeeds.length - 1; i >= 0; i -= 1) {
        if (feedIdsToDelete.includes(mockUserFeeds[i].id)) {
          mockUserFeeds.splice(i, 1);
        }
      }

      await delay(500);

      return HttpResponse.json<DeleteUserFeedsOutput>({
        results: feedIdsToDelete.map((id) => ({
          id,
          deleted: true,
          isLegacy: false,
        })),
      });
    }

    await delay(500);

    return HttpResponse.json(
      {},
      {
        status: 500,
      }
    );
  }),

  http.post("/api/v1/user-feeds/deduplicate-feed-urls", async ({ request }) => {
    const { urls } = (await request.json()) as CreateUserFeedDeduplicatedUrlsInput["details"];

    await delay(500);

    return HttpResponse.json<CreateUserFeedDeduplicatedUrlsOutput>({
      result: {
        urls,
      },
    });
  }),

  http.post("/api/v1/user-feeds/url-validation", async ({ request }) => {
    const { url } = (await request.json()) as CreateUserFeedUrlValidationInput["details"];

    await delay(500);

    let shouldReturnDifferentUrl = true;

    if (url.includes("bulk")) {
      await delay(1000);
      const shouldReturnError = Math.random() > 1;

      const sampleErrorCodes: ApiErrorCode[] = [
        ApiErrorCode.FEED_FETCH_FAILED,
        ApiErrorCode.FEED_INVALID,
        ApiErrorCode.FEED_LIMIT_REACHED,
        ApiErrorCode.FEED_INVALID_SSL_CERT,
        ApiErrorCode.FEED_REQUEST_FORBIDDEN,
        ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR,
        ApiErrorCode.FEED_REQUEST_TIMEOUT,
      ];

      const randomErrorCode = sampleErrorCodes[Math.floor(Math.random() * sampleErrorCodes.length)];

      const mockApiError = generateMockApiErrorResponse({
        code: randomErrorCode,
      });

      shouldReturnDifferentUrl = Math.random() > 1;

      if (shouldReturnError) {
        return HttpResponse.json(mockApiError, {
          status: 400,
        });
      }
    }

    return HttpResponse.json<CreateUserFeedUrlValidationOutput>({
      result: {
        resolvedToUrl: shouldReturnDifferentUrl ? "https://www.monitorss.xyz" : null,
      },
    });
  }),

  http.post("/api/v1/user-feeds", async ({ request }) => {
    const { url } = (await request.json()) as CreateUserFeedInput["details"];

    await delay(500);

    if (url.includes("bulk")) {
      await delay(1000);
      const shouldReturnError = Math.random() > 1;

      const sampleErrorCodes: ApiErrorCode[] = [
        ApiErrorCode.FEED_FETCH_FAILED,
        ApiErrorCode.FEED_INVALID,
        ApiErrorCode.FEED_LIMIT_REACHED,
        ApiErrorCode.FEED_INVALID_SSL_CERT,
        ApiErrorCode.FEED_REQUEST_FORBIDDEN,
        ApiErrorCode.FEED_REQUEST_INTERNAL_ERROR,
        ApiErrorCode.FEED_REQUEST_TIMEOUT,
      ];

      const randomErrorCode = sampleErrorCodes[Math.floor(Math.random() * sampleErrorCodes.length)];

      const mockApiError = generateMockApiErrorResponse({
        code: randomErrorCode,
      });

      if (shouldReturnError) {
        return HttpResponse.json(mockApiError, {
          status: 400,
        });
      }
    }

    return HttpResponse.json<CreateUserFeedOutput>(
      {
        result: mockUserFeeds[0],
      },
      {
        status: 200,
      }
    );
  }),

  http.delete("/api/v1/user-feeds/:feedId", async ({ params }) => {
    const { feedId } = params;

    const index = mockUserFeeds.findIndex((feed) => feed.id === feedId);

    if (index === -1) {
      return HttpResponse.json(
        generateMockApiErrorResponse({
          code: "FEED_NOT_FOUND",
        }),
        {
          status: 404,
        }
      );
    }

    mockUserFeeds.splice(index, 1);

    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),

  http.patch("/api/v1/user-feeds/:feedId", async ({ params }) => {
    const matchingUserFeed = mockUserFeeds.find((feed) => feed.id === params.feedId);

    if (!matchingUserFeed) {
      return HttpResponse.json({}, { status: 404 });
    }

    await delay(500);

    return HttpResponse.json<UpdateUserFeedOutput>({
      result: matchingUserFeed,
    });
  }),

  http.get("/api/v1/user-feeds/:feedId", async ({ params }) => {
    const { feedId } = params;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return HttpResponse.json(
        generateMockApiErrorResponse({
          code: "FEED_NOT_FOUND",
        }),
        {
          status: 404,
        }
      );
    }

    await delay(500);

    return HttpResponse.json<GetUserFeedOutput>({
      result: feed,
    });
  }),

  http.post("/api/v1/user-feeds/:feedId/get-articles", async ({ request }) => {
    const { skip, limit, filters } = (await request.json()) as {
      skip: number;
      limit: number;
      filters: Record<string, unknown>;
    };

    const useSkip = skip || 0;
    const useLimit = limit || 10;

    const articles = mockUserFeedArticles
      .filter((article) => {
        if (filters?.articleId) {
          return article.id === filters.articleId;
        }

        return true;
      })
      .slice(useSkip, useSkip + useLimit);

    await delay(500);

    return HttpResponse.json<GetUserFeedArticlesOutput>({
      result: {
        articles,
        totalArticles: mockUserFeedArticles.length,
        requestStatus: UserFeedArticleRequestStatus.Success,
        response: {
          statusCode: 200,
        },
        filterStatuses: mockUserFeedArticles.map((_, index) => ({ passed: index % 2 === 0 })),
        selectedProperties: ["id", "title"],
      },
    });
  }),

  http.post("/api/v1/user-feeds/:feedId/get-article-properties", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedArticlePropertiesOutput>({
      result: {
        requestStatus: UserFeedArticleRequestStatus.Success,
        properties: ["id", "title"],
      },
    });
  }),

  http.get("/api/v1/user-feeds/:feedId/requests", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedRequestsOutput>({
      result: {
        requests: mockUserFeedRequests,
        nextRetryTimestamp: null,
        feedHostGlobalRateLimit: null,
      },
    });
  }),

  http.get("/api/v1/user-feeds/:feedId/delivery-logs", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedDeliveryLogsOutput>({
      result: {
        logs: mockUserFeedDeliveryLogs,
      },
    });
  }),

  http.get("/api/v1/user-feeds/:feedId/article-properties", async () => {
    await delay(500);

    return HttpResponse.json<GetUserFeedArticlePropertiesOutput>({
      result: {
        requestStatus: UserFeedArticleRequestStatus.Success,
        properties: ["id", "title"],
      },
    });
  }),

  http.get("/api/v1/user-feeds/:feedId/daily-limit", async () => {
    await delay(500);

    return HttpResponse.json({
      result: {
        current: 100,
        max: 500,
      },
    });
  }),

  http.get("/api/v1/user-feeds/:feedId/retry", async ({ params }) => {
    const { feedId } = params as Record<string, unknown>;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      await delay(500);

      return HttpResponse.json(
        generateMockApiErrorResponse({
          code: "FEED_NOT_FOUND",
        }),
        {
          status: 404,
        }
      );
    }

    feed.disabledCode = undefined;
    feed.healthStatus = UserFeedHealthStatus.Ok;

    await delay(500);

    return HttpResponse.json<UpdateUserFeedOutput>({
      result: feed,
    });
  }),

  http.get("/api/v1/feeds/:feedId", async () => {
    await delay(500);

    return HttpResponse.json<GetFeedOutput>({
      result: mockFeeds[0],
    });
  }),

  http.get("/api/v1/feeds/:feedId", async () => {
    await delay(500);

    return HttpResponse.json<GetFeedOutput>({
      result: mockFeeds[0],
    });
  }),

  http.delete("/api/v1/feeds/:feedId", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),

  http.post("/api/v1/feeds/:feedId/clone", async () => {
    await delay(500);

    return HttpResponse.json<CloneFeedOutput>({
      results: mockFeeds,
    });
  }),

  http.post("/api/v1/user-feeds/:feedId/connections/discord-channels", async () => {
    await delay(500);

    return HttpResponse.json<CreateDiscordChannelConnectionOutput>(
      {
        result: mockFeedChannelConnections[0],
      },
      {
        status: 400,
      }
    );
  }),

  http.post("/api/v1/user-feeds/:feedId/connections/discord-channels/:id/clone", async () => {
    await delay(500);

    return HttpResponse.json<CreateDiscordChannelConnectionCloneOutput>(
      {
        result: {
          id: mockUserFeeds[0].connections[1].id,
        },
      },
      {
        status: 400,
      }
    );
  }),

  http.post(
    "/api/v1/user-feeds/:feedId/connections/discord-channels/:id/copy-connection-settings",
    async () => {
      await delay(500);

      return new HttpResponse(null, {
        status: 204,
      });
    }
  ),

  http.post("/api/v1/user-feeds/:feedId/connections/discord-channels/:id/test", async () => {
    await delay(500);

    return HttpResponse.json<CreateDiscordChannelConnectionTestArticleOutput>(
      {
        result: mockSendTestArticleResult,
      },
      { status: 404 }
    );
  }),

  http.post("/api/v1/user-feeds/:feedId/connections/discord-channels/:id/preview", async () => {
    await delay(500);

    return HttpResponse.json<CreateDiscordChannelConnectionPreviewOutput>({
      result: mockCreatePreviewResult,
    });
  }),

  http.patch("/api/v1/user-feeds/:feedId/connections/discord-channels/:id", async () => {
    await delay(500);

    return HttpResponse.json<UpdateDiscordChannelConnectionOutput>({
      result: mockFeedChannelConnections[0],
    });
  }),

  http.delete("/api/v1/user-feeds/:feedId/connections/discord-channels/:id", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 404,
    });
  }),

  http.delete("/api/v1/user-feeds/:feedId/connections/discord-webhooks/:id", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),

  http.get("/api/v1/feeds/:feedId/subscribers", async () => {
    return HttpResponse.json<GetFeedSubscribersOutput>({
      results: mockFeedSubscribers,
      total: mockFeedSubscribers.length,
    });
  }),

  http.post("/api/v1/feeds/:feedId/subscribers", async () => {
    await delay(500);

    return HttpResponse.json<CreateFeedSubscriberOutput>({
      result: {
        id: "3",
        discordId: mockDiscordRoles[2].id,
        feed: mockFeeds[0].id,
        filters: [],
        type: "role",
      },
    });
  }),

  http.patch("/api/v1/feeds/:feedId/subscribers/:subscriberId", async () => {
    await delay(500);

    return HttpResponse.json<UpdateFeedSubscriberOutput>({
      result: mockFeedSubscribers[0],
    });
  }),

  http.delete("/api/v1/feeds/:feedId/subscribers/:subscriberId", async () => {
    await delay(500);

    return new HttpResponse(null, {
      status: 204,
    });
  }),

  http.patch("/api/v1/feeds/:feedId", async () => {
    await delay(500);

    return HttpResponse.json(
      generateMockApiErrorResponse({
        code: "WEBHOOK_INVALID",
      }),
      {
        status: 400,
      }
    );
  }),

  http.get("/api/v1/feeds/:feedId/articles", async () => {
    return HttpResponse.json<GetFeedArticlesOutput>({
      result: mockFeedArticles,
    });
  }),

  http.get("/api/v1/feeds/:feedId/refresh", async () => {
    return HttpResponse.json<GetFeedOutput>({
      result: mockFeeds[0],
    });
  }),
];

export default handlers;
