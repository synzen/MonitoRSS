import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import dayjs from "dayjs";
import {
  LegacyFeedConversionService,
  type LegacyFeedConversionServiceDeps,
} from "../../src/services/legacy-feed-conversion/legacy-feed-conversion.service";
import type { IFeed } from "../../src/repositories/interfaces/feed.types";
import type { IFeedSubscriber } from "../../src/repositories/interfaces/feed-subscriber.types";
import { UserFeedHealthStatus } from "../../src/repositories/shared/enums";

describe("LegacyFeedConversionService", { concurrency: true }, () => {
  function createMockDeps(): LegacyFeedConversionServiceDeps {
    return {
      discordApiService: {
        getWebhook: mock.fn(async () => ({
          id: "123",
          token: "token",
        })),
        getChannel: mock.fn(async () => ({
          name: "channel-name",
        })),
      } as unknown as LegacyFeedConversionServiceDeps["discordApiService"],
      supportersService: {
        getBenefitsOfDiscordUser: mock.fn(async () => ({
          refreshRateSeconds: 600,
          maxUserFeeds: 10,
        })),
      } as unknown as LegacyFeedConversionServiceDeps["supportersService"],
      feedRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["feedRepository"],
      feedSubscriberRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["feedSubscriberRepository"],
      feedFilteredFormatRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["feedFilteredFormatRepository"],
      failRecordRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["failRecordRepository"],
      discordServerProfileRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["discordServerProfileRepository"],
      userFeedRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["userFeedRepository"],
      userFeedLimitOverrideRepository:
        {} as unknown as LegacyFeedConversionServiceDeps["userFeedLimitOverrideRepository"],
    };
  }

  const baseFeed: IFeed = Object.freeze({
    id: "feed-id-1",
    title: "title",
    url: "url",
    guild: "guild",
    addedAt: new Date(),
    channel: "channel",
    embeds: [],
  });

  const baseData = {
    discordUserId: "123",
    subscribers: [
      {
        id: "sub-1",
        feedId: "feed-id-1",
        subscriberId: "1",
        type: "role" as const,
        filters: {
          tags: ["tag1"],
        },
      } as IFeedSubscriber,
    ],
  };

  describe("getUserFeedEquivalent", () => {
    it("converts ncomparisons correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input: IFeed = {
        ...baseFeed,
        ncomparisons: ["a", "b"],
      };

      const result = await service.getUserFeedEquivalent(input, baseData);

      assert.deepStrictEqual(result.blockingComparisons, ["a", "b"]);
    });

    it("converts pcomparisons correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input: IFeed = {
        ...baseFeed,
        pcomparisons: ["a", "b"],
      };

      const result = await service.getUserFeedEquivalent(input, baseData);

      assert.deepStrictEqual(result.passingComparisons, ["a", "b"]);
    });

    it("sets created and updated dates correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input: IFeed = {
        ...baseFeed,
        createdAt: new Date("2021-01-01"),
        updatedAt: new Date("2021-01-02"),
      };

      const result = await service.getUserFeedEquivalent(input, baseData);

      assert.deepStrictEqual(result.createdAt, new Date("2021-01-01"));
      assert.deepStrictEqual(result.updatedAt, new Date("2021-01-02"));
    });

    it("sets date check options when checkDates is true", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input: IFeed = {
        ...baseFeed,
        checkDates: true,
      };

      const result = await service.getUserFeedEquivalent(input, baseData);

      assert.deepStrictEqual(result.dateCheckOptions, {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      });
    });

    it("sets date format when profile has dateFormat", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = await service.getUserFeedEquivalent(baseFeed, {
        ...baseData,
        profile: {
          id: "profile-1",
          dateFormat: "dateFormat",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      assert.strictEqual(result.formatOptions?.dateFormat, "dateFormat");
    });

    it("sets date format to undefined when profile has no dateFormat", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = await service.getUserFeedEquivalent(baseFeed, baseData);

      assert.strictEqual(result.formatOptions?.dateFormat, undefined);
    });

    it("sets date timezone when profile has timezone", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = await service.getUserFeedEquivalent(baseFeed, {
        ...baseData,
        profile: {
          id: "profile-1",
          timezone: "timezone",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      assert.strictEqual(result.formatOptions?.dateTimezone, "timezone");
    });

    it("sets title correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const feed: IFeed = {
        ...baseFeed,
        title: "new title",
      };

      const result = await service.getUserFeedEquivalent(feed, baseData);

      assert.strictEqual(result.title, "new title");
    });

    it("sets url correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const feed: IFeed = {
        ...baseFeed,
        url: "new url",
      };

      const result = await service.getUserFeedEquivalent(feed, baseData);

      assert.strictEqual(result.url, "new url");
    });

    it("sets user correctly", async () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = await service.getUserFeedEquivalent(baseFeed, baseData);

      assert.deepStrictEqual(result.user, {
        discordUserId: baseData.discordUserId,
      });
    });

    describe("channel connections", () => {
      it("adds placeholder limits", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);

        const result = await service.getUserFeedEquivalent(baseFeed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.details.placeholderLimits, [
          { characterCount: 790, placeholder: "summary", appendString: "..." },
          {
            characterCount: 790,
            placeholder: "description",
            appendString: "...",
          },
          { characterCount: 150, placeholder: "title", appendString: "..." },
        ]);
      });

      it("creates a channel connection if there is no webhook", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);

        const result = await service.getUserFeedEquivalent(baseFeed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.details.channel, {
          id: baseFeed.channel,
          guildId: baseFeed.guild,
        });
      });

      it("sets split options correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          split: { enabled: true },
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.splitOptions, { isEnabled: true });
      });

      it("sets content correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          text: "hello world",
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.content, "hello world");
      });

      it("sets formatTables correctly when true", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          formatTables: true,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.formatter.formatTables, true);
      });

      it("sets formatTables correctly when false", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          formatTables: false,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.formatter.formatTables, false);
      });

      it("sets createdAt correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          createdAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.createdAt, new Date("2020-01-01"));
      });

      it("sets updatedAt correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          updatedAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.updatedAt, new Date("2020-01-01"));
      });

      it("sets custom placeholders correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          split: { enabled: true },
          regexOps: {
            title: [
              {
                name: "mytitle",
                search: { regex: "myregex" },
                replacement: "myreplacement",
                replacementDirect: "myreplacementdirect",
              },
              {
                name: "mytitle",
                search: { regex: "myregex2" },
                replacement: "myreplacement2",
              },
            ],
            description: [
              {
                name: "mydescription",
                search: { regex: "myregex" },
                replacement: "myreplacement",
                replacementDirect: "myreplacementdirect2",
              },
              {
                name: "mydescription2",
                search: { regex: "myregex2" },
                replacement: "myreplacement2",
              },
            ],
          },
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.customPlaceholders?.length, 3);
        assert.deepStrictEqual(connection?.customPlaceholders?.[0], {
          id: "title::mytitle",
          referenceName: "mytitle",
          sourcePlaceholder: "title",
          steps: [
            {
              type: "REGEX",
              id: connection?.customPlaceholders?.[0]?.steps[0]?.id,
              regexSearch: "myregex",
              replacementString: "myreplacementdirect",
            },
            {
              type: "REGEX",
              id: connection?.customPlaceholders?.[0]?.steps[1]?.id,
              regexSearch: "myregex2",
              replacementString: "myreplacement2",
            },
          ],
        });
        assert.strictEqual(
          connection?.customPlaceholders?.[1]?.id,
          "description::mydescription",
        );
        assert.strictEqual(
          connection?.customPlaceholders?.[2]?.id,
          "description::mydescription2",
        );
      });

      it("sets mentions correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);

        const result = await service.getUserFeedEquivalent(baseFeed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.mentions?.targets?.[0], {
          id: "sub-1",
          type: "role",
          filters: {
            expression: {
              type: "LOGICAL",
              op: "AND",
              children: [
                {
                  type: "LOGICAL",
                  op: "OR",
                  children: [
                    {
                      type: "RELATIONAL",
                      op: "CONTAINS",
                      left: { type: "ARTICLE", value: "processed::categories" },
                      right: { type: "STRING", value: "tag1" },
                    },
                  ],
                },
              ],
            },
          },
        });
      });

      it("sets stripImages to false when imgLinksExistence is true", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          imgLinksExistence: true,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.formatter.stripImages, false);
      });

      it("sets stripImages to true when imgLinksExistence is false", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          imgLinksExistence: false,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.formatter.stripImages, true);
      });

      it("sets disableImageLinkPreviews to false when imgPreviews is true", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          imgPreviews: true,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(
          connection?.details.formatter.disableImageLinkPreviews,
          false,
        );
      });

      it("sets disableImageLinkPreviews to true when imgPreviews is false", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseFeed,
          imgPreviews: false,
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(
          connection?.details.formatter.disableImageLinkPreviews,
          true,
        );
      });
    });

    describe("webhook connections", () => {
      const baseWebhookFeed: IFeed = {
        ...baseFeed,
        webhook: {
          id: "1",
          avatar: "avatar",
          name: "name",
          url: "url",
        },
      };

      it("sets the webhook details correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);

        const result = await service.getUserFeedEquivalent(
          baseWebhookFeed,
          baseData,
        );
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.details.webhook, {
          id: "1",
          guildId: baseFeed.guild,
          name: "name",
          iconUrl: "avatar",
          token: "token",
        });
      });

      it("sets split options correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseWebhookFeed,
          split: { enabled: true },
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.deepStrictEqual(connection?.splitOptions, { isEnabled: true });
      });

      it("sets content correctly", async () => {
        const deps = createMockDeps();
        const service = new LegacyFeedConversionService(deps);
        const feed: IFeed = {
          ...baseWebhookFeed,
          text: "hello world",
        };

        const result = await service.getUserFeedEquivalent(feed, baseData);
        const connection = result.connections.discordChannels[0];

        assert.strictEqual(connection?.details.content, "hello world");
      });
    });
  });

  describe("getHealthStatus", () => {
    it("returns ok if there is no fail record", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.getHealthStatus();

      assert.strictEqual(result, UserFeedHealthStatus.Ok);
    });

    it("returns failed if the fail record is older than 3 days", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.getHealthStatus({
        id: "1",
        failedAt: dayjs().subtract(4, "day").toDate(),
        alerted: false,
      });

      assert.strictEqual(result, UserFeedHealthStatus.Failed);
    });

    it("returns failing if the fail record is newer than 3 days", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.getHealthStatus({
        id: "1",
        failedAt: dayjs().subtract(2, "day").toDate(),
        alerted: false,
      });

      assert.strictEqual(result, UserFeedHealthStatus.Failing);
    });
  });

  describe("convertPlaceholders", () => {
    it("converts regex placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {title:custom}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [
          { regexOpPh: "title:custom", newPh: "custom::custom" },
        ],
      });

      assert.strictEqual(result, "test {{custom::custom}}");
    });

    it("converts subscriptions placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {subscriptions}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{discord::mentions}}");
    });

    it("converts subscribers placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {subscribers}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{discord::mentions}}");
    });

    it("converts date placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {date}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{pubdate}}");
    });

    it("converts single-brace placeholders to double brace", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {placeholder}\n\n{placeholder2} {{placehodler3}}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{placeholder}}\n\n{{placeholder2}} {{{placehodler3}}}",
      );
    });

    it("returns undefined if undefined is passed", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(undefined, {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, undefined);
    });

    it("converts summary images", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {summary:image1} {summary:image2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::summary::image1}} {{extracted::summary::image2}}",
      );
    });

    it("converts summary anchors", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {summary:anchor1} {summary:anchor2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::summary::anchor1}} {{extracted::summary::anchor2}}",
      );
    });

    it("converts description anchors", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {description:anchor1} {description:anchor2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::description::anchor1}} {{extracted::description::anchor2}}",
      );
    });

    it("converts description images", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {description:image1} {description:image2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::description::image1}} {{extracted::description::image2}}",
      );
    });

    it("converts title anchors", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {title:anchor1} {title:anchor2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::title::anchor1}} {{extracted::title::anchor2}}",
      );
    });

    it("converts title images", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {title:image1} {title:image2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{extracted::title::image1}} {{extracted::title::image2}}",
      );
    });

    it("converts raw placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {raw:description}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{description}}");
    });

    it("converts raw placeholders that are multiple levels deep", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {raw:description_level1_level2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(result, "test {{description__level1__level2}}");
    });

    it("converts raw placeholders with dashes", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {raw:description-is-here}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(result, "test {{description:is:here}}");
    });

    it("converts raw placeholders with array indices", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {raw:description[1]}", {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{description__1}}");
    });

    it("converts raw placeholders with array indices multiple levels deep", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {raw:description_level1[1]_level2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(result, "test {{description__level1__1__level2}}");
    });

    it("converts raw placeholders with array indices and dashes", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {raw:description-is-here[1]}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(result, "test {{description:is:here__1}}");
    });

    it("converts raw placeholders with array indices and dashes multiple levels deep", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {raw:description_level1-is-here[1]_level2}",
        {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{description__level1:is:here__1__level2}}",
      );
    });

    it("converts descriptions for youtube feeds", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders("test {description}", {
        isYoutube: true,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result, "test {{media:group__media:description__#}}");
    });

    it("converts fallback placeholders with image URLs", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertPlaceholders(
        "test {item1||item2||https://image.com||http://image.com}",
        {
          isYoutube: true,
          regexPlaceholdersToReplace: [],
        },
      );

      assert.strictEqual(
        result,
        "test {{item1||item2||text::https://image.com||text::http://image.com}}",
      );
    });
  });

  describe("convertEmbeds", () => {
    it("converts embeds including placeholders", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input = [
        {
          title: "title {placeholder}",
          description: "description {placeholder}",
          url: "url {placeholder}",
          color: "123",
          footerIconURL: "footer icon url {placeholder}",
          footerText: "footer text {placeholder}",
          imageURL: "image url {placeholder}",
          authorIconURL: "author icon url",
          authorName: "author name {placeholder}",
          authorURL: "author url {placeholder}",
          thumbnailURL: "thumbnail url {placeholder}",
          timestamp: "now",
          fields: [
            {
              name: "field name {placeholder}",
              value: "field value {placeholder}",
              inline: true,
            },
          ],
        },
      ];

      const result = service.convertEmbeds(input, {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.deepStrictEqual(result, [
        {
          title: "title {{placeholder}}",
          description: "description {{placeholder}}",
          url: "url {{placeholder}}",
          color: "123",
          footerIconURL: "footer icon url {{placeholder}}",
          footerText: "footer text {{placeholder}}",
          imageURL: "image url {{placeholder}}",
          authorIconURL: "author icon url",
          authorName: "author name {{placeholder}}",
          authorURL: "author url {{placeholder}}",
          thumbnailURL: "thumbnail url {{placeholder}}",
          timestamp: "now",
          fields: [
            {
              name: "field name {{placeholder}}",
              value: "field value {{placeholder}}",
              inline: true,
            },
          ],
        },
      ]);
    });

    it("converts embeds with no color", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const input = [
        {
          title: "title {placeholder}",
        },
      ];

      const result = service.convertEmbeds(input, {
        isYoutube: false,
        regexPlaceholdersToReplace: [],
      });

      assert.strictEqual(result[0]?.color, undefined);
    });
  });

  describe("convertRegexFilters", () => {
    it("converts correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: "myregex",
        description: "myregex2",
      };

      const result = service.convertRegexFilters(filters);

      assert.deepStrictEqual(result, {
        expression: {
          type: "LOGICAL",
          op: "OR",
          children: [
            {
              type: "RELATIONAL",
              op: "MATCHES",
              left: { type: "ARTICLE", value: "title" },
              right: { type: "STRING", value: "myregex" },
            },
            {
              type: "RELATIONAL",
              op: "MATCHES",
              left: { type: "ARTICLE", value: "description" },
              right: { type: "STRING", value: "myregex2" },
            },
          ],
        },
      });
    });

    it("converts inverted correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: "myregex",
        description: "myregex2",
      };

      const result = service.convertRegexFilters(filters, { invert: true });

      assert.deepStrictEqual(result, {
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "RELATIONAL",
              op: "MATCHES",
              not: true,
              left: { type: "ARTICLE", value: "title" },
              right: { type: "STRING", value: "myregex" },
            },
            {
              type: "RELATIONAL",
              op: "MATCHES",
              not: true,
              left: { type: "ARTICLE", value: "description" },
              right: { type: "STRING", value: "myregex2" },
            },
          ],
        },
      });
    });

    it("handles raw categories by removing raw: prefix", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        "raw:category": "myregex",
      };

      const result = service.convertRegexFilters(filters);
      const children = (result?.expression as Record<string, unknown>)
        .children as Array<Record<string, unknown>>;

      assert.deepStrictEqual(
        (children[0]?.left as Record<string, unknown>)?.value,
        "category",
      );
    });

    it("returns undefined if undefined is passed", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertRegexFilters(undefined);

      assert.strictEqual(result, undefined);
    });

    it("returns undefined if empty object is passed", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertRegexFilters({});

      assert.strictEqual(result, undefined);
    });
  });

  describe("convertRegularFilters", () => {
    it("converts broad filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["~filter1"],
        description: ["~filter2"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;
      const orChildren = children[0] as Record<string, unknown>;
      const orChildrenArr = orChildren.children as Array<
        Record<string, unknown>
      >;

      assert.strictEqual(expression.type, "LOGICAL");
      assert.strictEqual(expression.op, "AND");
      assert.strictEqual(orChildren.op, "OR");
      assert.strictEqual(orChildrenArr[0]?.op, "CONTAINS");
      assert.deepStrictEqual(orChildrenArr[0]?.left, {
        type: "ARTICLE",
        value: "title",
      });
      assert.deepStrictEqual(orChildrenArr[0]?.right, {
        type: "STRING",
        value: "filter1",
      });
    });

    it("converts regular filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["filter1"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;
      const orChildren = children[0] as Record<string, unknown>;
      const orChildrenArr = orChildren.children as Array<
        Record<string, unknown>
      >;

      assert.strictEqual(orChildrenArr[0]?.op, "EQ");
      assert.deepStrictEqual(orChildrenArr[0]?.right, {
        type: "STRING",
        value: "filter1",
      });
    });

    it("converts negated filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["!filter1"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;

      assert.strictEqual(children[1]?.type, "RELATIONAL");
      assert.strictEqual(children[1]?.op, "EQ");
      assert.strictEqual(children[1]?.not, true);
      assert.deepStrictEqual(children[1]?.right, {
        type: "STRING",
        value: "filter1",
      });
    });

    it("converts broad negated filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["!~filter1"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;

      assert.strictEqual(children[1]?.type, "RELATIONAL");
      assert.strictEqual(children[1]?.op, "CONTAINS");
      assert.strictEqual(children[1]?.not, true);
      assert.deepStrictEqual(children[1]?.right, {
        type: "STRING",
        value: "filter1",
      });
    });

    it("returns undefined if undefined is passed", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertRegularFilters(undefined);

      assert.strictEqual(result, undefined);
    });

    it("returns undefined if empty object is passed", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);

      const result = service.convertRegularFilters({});

      assert.strictEqual(result, undefined);
    });

    it("converts combination of negated and non-negated filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["!~filter1", "~filter4"],
        description: ["filter2", "!filter3"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;
      const orChildren = children[0] as Record<string, unknown>;
      const orChildrenArr = orChildren.children as Array<
        Record<string, unknown>
      >;

      assert.strictEqual(expression.type, "LOGICAL");
      assert.strictEqual(expression.op, "AND");
      assert.strictEqual(orChildrenArr.length, 2);
      assert.strictEqual(orChildrenArr[0]?.op, "CONTAINS");
      assert.deepStrictEqual(orChildrenArr[0]?.right, {
        type: "STRING",
        value: "filter4",
      });
      assert.strictEqual(orChildrenArr[1]?.op, "EQ");
      assert.deepStrictEqual(orChildrenArr[1]?.right, {
        type: "STRING",
        value: "filter2",
      });
      assert.strictEqual(children[1]?.op, "CONTAINS");
      assert.strictEqual(children[1]?.not, true);
      assert.strictEqual(children[2]?.op, "EQ");
      assert.strictEqual(children[2]?.not, true);
    });

    it("converts inverted combination of negated and non-negated filters correctly", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        title: ["!~filter1", "~filter4"],
        description: ["filter2", "!filter3"],
      };

      const result = service.convertRegularFilters(filters, { invert: true });
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;
      const orChildren = children[0] as Record<string, unknown>;
      const orChildrenArr = orChildren.children as Array<
        Record<string, unknown>
      >;

      assert.strictEqual(expression.type, "LOGICAL");
      assert.strictEqual(expression.op, "OR");
      assert.strictEqual(orChildren.op, "OR");
      assert.strictEqual(orChildrenArr[0]?.op, "CONTAINS");
      assert.strictEqual(orChildrenArr[0]?.not, true);
      assert.deepStrictEqual(orChildrenArr[0]?.right, {
        type: "STRING",
        value: "filter4",
      });
      assert.strictEqual(orChildrenArr[1]?.op, "EQ");
      assert.strictEqual(orChildrenArr[1]?.not, true);
      assert.deepStrictEqual(orChildrenArr[1]?.right, {
        type: "STRING",
        value: "filter2",
      });
      assert.strictEqual(children[1]?.op, "CONTAINS");
      assert.strictEqual(children[1]?.not, false);
      assert.strictEqual(children[2]?.op, "EQ");
      assert.strictEqual(children[2]?.not, false);
    });

    it("removes raw: from filter categories", () => {
      const deps = createMockDeps();
      const service = new LegacyFeedConversionService(deps);
      const filters = {
        "raw:title": ["filter1"],
      };

      const result = service.convertRegularFilters(filters);
      const expression = result?.expression as Record<string, unknown>;
      const children = expression.children as Array<Record<string, unknown>>;
      const orChildren = children[0] as Record<string, unknown>;
      const orChildrenArr = orChildren.children as Array<
        Record<string, unknown>
      >;

      assert.deepStrictEqual(orChildrenArr[0]?.left, {
        type: "ARTICLE",
        value: "title",
      });
    });
  });
});
