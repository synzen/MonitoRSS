// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from "msw";
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
  CreateUserFeedLegacyRestoreOutput,
  CreateUserFeedManagementInviteOutput,
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

const handlers = [
  rest.get("/api/v1/subscription-products/update-preview", (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<GetSubscriptionChangePreviewOutput>({
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
      })
    );
  }),
  rest.post("/api/v1/subscription-products/update", (req, res, ctx) => {
    return res(ctx.delay(500), ctx.status(204));
  }),
  rest.get("/api/v1/subscription-products/cancel", (req, res, ctx) => {
    return res(ctx.delay(500), ctx.status(204));
  }),
  rest.get("/api/v1/subscription-products", (req, res, ctx) => {
    const currencyCode = req.url.searchParams.get("currency") || "USD";

    return res(
      ctx.delay(500),
      ctx.json<GetSubscriptionProductsOutput>({
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
      })
    );
  }),
  rest.post("/api/v1/error-reports", (req, res, ctx) => {
    return res(ctx.delay(500), ctx.json({}));
  }),

  rest.get("/api/v1/users/@me", (req, res, ctx) => {
    return res(ctx.delay(500), ctx.json<GetUserMeOutput>({ result: mockUserMe }));
  }),

  rest.patch("/api/v1/users/@me", (req, res, ctx) => {
    return res(ctx.delay(500), ctx.json<UpdateUserMeOutput>({ result: mockUserMe }));
  }),

  rest.get("/api/v1/discord-users/bot", (req, res, ctx) =>
    res(
      ctx.json<GetDiscordBotOutput>({
        result: mockDiscordBot,
      })
    )
  ),
  rest.get("/api/v1/discord-users/@me", (req, res, ctx) =>
    res(ctx.json<GetDiscordMeOutput>(mockDiscordUserMe))
  ),

  rest.get("/api/v1/discord-users/:id", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.json<GetDiscordUserOutput>({
        result: mockDiscordUser,
      })
    )
  ),

  rest.get("/api/v1/discord-users/@me/auth-status", (req, res, ctx) =>
    res(
      ctx.json<GetDiscordAuthStatusOutput>({
        authenticated: true,
      })
    )
  ),

  rest.patch("/api/v1/discord-users/@me/supporter", (req, res, ctx) => res(ctx.status(204))),

  rest.get("/api/v1/discord-users/@me/servers", (req, res, ctx) =>
    res(
      ctx.json<GetServersOutput>({
        total: mockDiscordServers.length,
        results: mockDiscordServers,
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/status", (req, res, ctx) =>
    res(
      ctx.json<GetServerStatusOutput>({
        result: {
          authorized: true,
        },
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/legacy-conversion", (req, res, ctx) =>
    res(ctx.delay(500), ctx.json<GetServerLegacyFeedBulkConversionOutput>(legacyFeedBulkConversion))
  ),

  rest.post("/api/v1/discord-servers/:serverId/legacy-conversion", (req, res, ctx) => {
    if (legacyFeedBulkConversion.status !== "IN_PROGRESS") {
      legacyFeedBulkConversion.status = "IN_PROGRESS";
    } else {
      legacyFeedBulkConversion.status = "COMPLETED";
      legacyFeedBulkConversion.failedFeeds = [];
    }

    return res(
      ctx.delay(1000),
      ctx.json<CreateServerLegacyFeedBulkConversionOutput>({
        total: 5,
      })
    );
  }),
  rest.get("/api/v1/discord-servers/:serverId", (req, res, ctx) =>
    res(
      ctx.json<GetServerSettingsOutput>({
        result: {
          profile: {
            dateFormat: "YYYY-MM-DD",
            dateLanguage: "en",
            timezone: "UTC",
          },
        },
      })
    )
  ),

  rest.patch("/api/v1/discord-servers/:serverId", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.json<UpdateServerSettingsOutput>({
        result: {
          profile: {
            dateFormat: "YYYY-MM-DD",
            dateLanguage: "en",
            timezone: "UTC",
          },
        },
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/legacy-feed-count", (req, res, ctx) => {
    return res(
      ctx.delay(700),
      ctx.json<GetLegacyFeedCountOutput>({
        result: {
          total: 5,
        },
      })
    );
  }),

  rest.get("/api/v1/discord-servers/:serverId/feeds", (req, res, ctx) => {
    const limit = Number(req.url.searchParams.get("limit") || "10");
    const offset = Number(req.url.searchParams.get("offset") || "0");
    const search = req.url.searchParams.get("search");

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

    return res(
      ctx.delay(700),
      ctx.json<GetFeedsOutput>({
        total: theseMockSummariesTotal,
        results,
      })
    );
  }),

  rest.get("/api/v1/discord-servers/:serverId/active-threads", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.json<GetServerActiveThreadsOutput>({
        total: mockDiscordThreads.length,
        results: mockDiscordThreads,
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/channels", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.json<GetServerChannelsOutput>({
        total: mockDiscordChannels.length,
        results: mockDiscordChannels,
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/roles", (req, res, ctx) =>
    res(
      // ctx.delay(1000),
      ctx.json<GetServerRolesOutput>({
        total: mockDiscordRoles.length,
        results: mockDiscordRoles,
      })
    )
  ),

  rest.get("/api/v1/discord-servers/:serverId/members", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.json<GetServerMembersOutput>({
        total: mockDiscordServerMembers.length,
        results: mockDiscordServerMembers,
      })
    )
  ),

  rest.get("/api/v1/discord-webhooks", (req, res, ctx) =>
    res(
      // ctx.status(403),
      // ctx.json(generateMockApiErrorResponse({
      //   code: 'WEBHOOKS_MANAGE_MISSING_PERMISSIONS',
      // })),
      ctx.json<GetDiscordWebhooksOutput>({
        results: mockDiscordWebhooks,
      })
    )
  ),

  rest.post("/api/v1/feeds", (req, res, ctx) =>
    res(
      ctx.delay(1000),
      ctx.status(403),
      ctx.json(
        generateMockApiErrorResponse({
          code: "WEBHOOKS_MANAGE_MISSING_PERMISSIONS",
        })
      )
    )
  ),

  rest.get("/api/v1/user-feed-management-invites/pending", async (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedManagementInvitesCountOutput>({
        total: mockUserFeedManagementInvites.length,
      })
    );
  }),

  rest.get("/api/v1/user-feed-management-invites", async (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedManagementInvitesOutput>({
        results: mockUserFeedManagementInvites,
      })
    );
  }),

  rest.post("/api/v1/user-feed-management-invites", async (req, res, ctx) => {
    const body = await req.json();
    const { feedId, discordUserId } = body as { feedId: string; discordUserId: string };

    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return res(
        ctx.delay(500),
        ctx.status(404),
        ctx.json(
          generateMockApiErrorResponse({
            code: "FEED_NOT_FOUND",
          })
        )
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

    return res(
      ctx.delay(500),
      ctx.json<CreateUserFeedManagementInviteOutput>({
        result: {
          status: "success",
        },
      })
    );
  }),

  rest.patch("/api/v1/user-feed-management-invites/:id/status", async (req, res, ctx) => {
    const { id } = req.params;

    mockUserFeedManagementInvites.splice(
      mockUserFeedManagementInvites.findIndex((u) => u.id === id),
      1
    );

    return res(ctx.delay(500), ctx.status(204));
  }),

  rest.post("/api/v1/user-feed-management-invites/:id/resend", async (req, res, ctx) => {
    const { id } = req.params;

    const matchedFeed = mockUserFeeds.find((f) =>
      f.shareManageOptions?.invites.find((u) => u.id === id)
    );

    if (!matchedFeed) {
      return res(ctx.delay(500), ctx.status(404), ctx.json({}));
    }

    matchedFeed.shareManageOptions!.invites.find((u) => u.id === id)!.status =
      UserFeedManagerStatus.Pending;

    return res(ctx.delay(500), ctx.status(204));
  }),

  rest.delete("/api/v1/user-feed-management-invites/:id", async (req, res, ctx) => {
    const { id } = req.params;
    const matchedFeed = mockUserFeeds.find((f) =>
      f.shareManageOptions?.invites.find((u) => u.id === id)
    );

    if (!matchedFeed) {
      return res(ctx.delay(500), ctx.status(404), ctx.json({}));
    }

    matchedFeed.shareManageOptions?.invites.splice(
      matchedFeed.shareManageOptions?.invites.findIndex((u) => u.id === id),
      1
    );

    return res(ctx.delay(500), ctx.status(204));
  }),

  rest.get("/api/v1/user-feeds", (req, res, ctx) => {
    const limit = Number(req.url.searchParams.get("limit") || "10");
    const offset = Number(req.url.searchParams.get("offset") || "0");
    const search = req.url.searchParams.get("search");
    const disabledCodes = req.url.searchParams.get("filters[disabledCodes]")?.split(",");

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

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedsOutput>({
        results: limitedResults,
        total: filtered.length,
      })
    );
  }),

  rest.post("/api/v1/user-feeds/:id/restore-to-legacy", async (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<CreateUserFeedLegacyRestoreOutput>({
        result: {
          status: "success",
        },
      })
    );
  }),

  rest.patch("/api/v1/user-feeds", async (req, res, ctx) => {
    const body = await req.json();

    if (body.op === "bulk-delete") {
      const castedBody = body.data as DeleteUserFeedsInput["data"];
      const feedIdsToDelete = castedBody.feeds.map((f) => f.id);

      for (let i = mockUserFeeds.length - 1; i >= 0; i -= 1) {
        if (feedIdsToDelete.includes(mockUserFeeds[i].id)) {
          mockUserFeeds.splice(i, 1);
        }
      }

      return res(
        ctx.delay(500),
        ctx.json<DeleteUserFeedsOutput>({
          results: feedIdsToDelete.map((id) => ({
            id,
            deleted: true,
            isLegacy: false,
          })),
        })
      );
    }

    return res(ctx.delay(500), ctx.status(500), ctx.json({}));
  }),

  rest.post("/api/v1/user-feeds", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CreateUserFeedOutput>({
        result: mockUserFeeds[0],
      })
    )
  ),

  rest.delete("/api/v1/user-feeds/:feedId", (req, res, ctx) => {
    const { feedId } = req.params;

    const index = mockUserFeeds.findIndex((feed) => feed.id === feedId);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json(
          generateMockApiErrorResponse({
            code: "FEED_NOT_FOUND",
          })
        )
      );
    }

    mockUserFeeds.splice(index, 1);

    return res(ctx.delay(500), ctx.status(204));
  }),

  rest.patch("/api/v1/user-feeds/:feedId", (req, res, ctx) => {
    const matchingUserFeed = mockUserFeeds.find((feed) => feed.id === req.params.feedId);

    if (!matchingUserFeed) {
      return res(ctx.status(404), ctx.json({}));
    }

    return res(
      ctx.delay(500),
      ctx.json<UpdateUserFeedOutput>({
        result: matchingUserFeed,
      })
    );
  }),

  rest.get("/api/v1/user-feeds/:feedId", (req, res, ctx) => {
    const { feedId } = req.params;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return res(
        ctx.status(404),
        ctx.json(
          generateMockApiErrorResponse({
            code: "FEED_NOT_FOUND",
          })
        )
      );
    }

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedOutput>({
        result: feed,
      })
    );
  }),

  rest.post("/api/v1/user-feeds/:feedId/get-articles", async (req, res, ctx) => {
    const { skip, limit, filters } = await req.json();

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

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedArticlesOutput>({
        result: {
          articles,
          totalArticles: mockUserFeedArticles.length,
          requestStatus: UserFeedArticleRequestStatus.Success,
          response: {
            statusCode: 403,
          },
          filterStatuses: mockUserFeedArticles.map((_, index) => ({ passed: index % 2 === 0 })),
          selectedProperties: ["id", "title"],
        },
      })
    );
  }),

  rest.post("/api/v1/user-feeds/:feedId/get-article-properties", async (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedArticlePropertiesOutput>({
        result: {
          requestStatus: UserFeedArticleRequestStatus.Success,
          properties: ["id", "title"],
        },
      })
    );
  }),

  rest.get("/api/v1/user-feeds/:feedId/requests", async (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<GetUserFeedRequestsOutput>({
        result: {
          requests: mockUserFeedRequests,
          nextRetryTimestamp: Math.floor(new Date(2020).getTime() / 1000),
        },
      })
    )
  ),

  rest.get("/api/v1/user-feeds/:feedId/delivery-logs", async (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<GetUserFeedDeliveryLogsOutput>({
        result: {
          logs: mockUserFeedDeliveryLogs,
        },
      })
    )
  ),

  rest.get("/api/v1/user-feeds/:feedId/article-properties", async (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<GetUserFeedArticlePropertiesOutput>({
        result: {
          requestStatus: UserFeedArticleRequestStatus.Success,
          properties: ["id", "title"],
        },
      })
    )
  ),

  rest.get("/api/v1/user-feeds/:feedId/daily-limit", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json({
        result: {
          current: 100,
          max: 500,
        },
      })
    )
  ),

  rest.get("/api/v1/user-feeds/:feedId/retry", (req, res, ctx) => {
    const { feedId } = req.params as Record<string, unknown>;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return res(
        ctx.status(404),
        ctx.json(
          generateMockApiErrorResponse({
            code: "FEED_NOT_FOUND",
          })
        )
      );
    }

    feed.disabledCode = undefined;
    feed.healthStatus = UserFeedHealthStatus.Ok;

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedOutput>({
        result: feed,
      })
    );
  }),

  rest.get("/api/v1/feeds/:feedId", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<GetFeedOutput>({
        result: mockFeeds[0],
      })
    )
  ),

  rest.get("/api/v1/feeds/:feedId", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<GetFeedOutput>({
        result: mockFeeds[0],
      })
    )
  ),

  rest.delete("/api/v1/feeds/:feedId", (req, res, ctx) => res(ctx.delay(500), ctx.status(204))),

  rest.post("/api/v1/feeds/:feedId/clone", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CloneFeedOutput>({
        results: mockFeeds,
      })
    )
  ),

  rest.post("/api/v1/user-feeds/:feedId/connections/discord-channels", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CreateDiscordChannelConnectionOutput>({
        result: mockFeedChannelConnections[0],
      })
    )
  ),

  rest.post("/api/v1/user-feeds/:feedId/connections/discord-channels/:id/clone", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CreateDiscordChannelConnectionCloneOutput>({
        result: {
          id: mockUserFeeds[0].connections[1].id,
        },
      })
    )
  ),

  rest.post(
    "/api/v1/user-feeds/:feedId/connections/discord-channels/:id/copy-connection-settings",
    (req, res, ctx) => res(ctx.delay(500), ctx.status(204))
  ),

  rest.post("/api/v1/user-feeds/:feedId/connections/discord-channels/:id/test", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CreateDiscordChannelConnectionTestArticleOutput>({
        result: mockSendTestArticleResult,
      })
    )
  ),

  rest.post(
    "/api/v1/user-feeds/:feedId/connections/discord-channels/:id/preview",
    (req, res, ctx) => {
      return res(
        ctx.delay(500),
        ctx.json<CreateDiscordChannelConnectionPreviewOutput>({
          result: mockCreatePreviewResult,
        })
      );
    }
  ),

  rest.patch("/api/v1/user-feeds/:feedId/connections/discord-channels/:id", (req, res, ctx) => {
    return res(
      ctx.delay(500),
      ctx.json<UpdateDiscordChannelConnectionOutput>({
        result: mockFeedChannelConnections[0],
      })
    );
  }),

  rest.delete("/api/v1/user-feeds/:feedId/connections/discord-channels/:id", (req, res, ctx) =>
    res(ctx.delay(500), ctx.status(204))
  ),

  rest.delete("/api/v1/user-feeds/:feedId/connections/discord-webhooks/:id", (req, res, ctx) =>
    res(ctx.delay(500), ctx.status(204))
  ),

  rest.get("/api/v1/feeds/:feedId/subscribers", (req, res, ctx) =>
    res(
      ctx.json<GetFeedSubscribersOutput>({
        results: mockFeedSubscribers,
        total: mockFeedSubscribers.length,
      })
    )
  ),

  rest.post("/api/v1/feeds/:feedId/subscribers", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<CreateFeedSubscriberOutput>({
        result: {
          id: "3",
          discordId: mockDiscordRoles[2].id,
          feed: mockFeeds[0].id,
          filters: [],
          type: "role",
        },
      })
    )
  ),

  rest.patch("/api/v1/feeds/:feedId/subscribers/:subscriberId", (req, res, ctx) =>
    res(
      ctx.delay(500),
      ctx.json<UpdateFeedSubscriberOutput>({
        result: mockFeedSubscribers[0],
      })
    )
  ),

  rest.delete("/api/v1/feeds/:feedId/subscribers/:subscriberId", (req, res, ctx) =>
    res(ctx.delay(500), ctx.status(204))
  ),

  rest.patch("/api/v1/feeds/:feedId", (req, res, ctx) =>
    res(
      ctx.status(400),
      ctx.json(
        generateMockApiErrorResponse({
          code: "WEBHOOK_INVALID",
        })
      )
      // ctx.json<UpdateFeedOutput>({
      //   result: mockFeeds[0],
      // }),
    )
  ),

  rest.get("/api/v1/feeds/:feedId/articles", (req, res, ctx) =>
    res(
      ctx.json<GetFeedArticlesOutput>({
        result: mockFeedArticles,
      })
    )
  ),

  rest.get("/api/v1/feeds/:feedId/refresh", (req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json<GetFeedOutput>({
        result: mockFeeds[0],
      })
    )
  ),
];

export default handlers;
