import dayjs from "dayjs";
import { Types } from "mongoose";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordServerProfileModel } from "../discord-servers/entities";
import { FailRecordModel } from "../feeds/entities/fail-record.entity";
import { FeedFilteredFormatModel } from "../feeds/entities/feed-filtered-format.entity";
import { FeedSubscriberModel } from "../feeds/entities/feed-subscriber.entity";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { UserFeedHealthStatus } from "../user-feeds/types";
import { LegacyFeedConversionService } from "./legacy-feed-conversion.service";

describe("LegacyFeedConversionService", () => {
  let service: LegacyFeedConversionService;
  const profileModel: DiscordServerProfileModel = {
    findById: jest.fn(),
  } as never;
  const feedModel: FeedModel = {} as never;
  const feedSubscriberModel: FeedSubscriberModel = {
    find: jest.fn(),
  } as never;
  const feedFilteredFormatModel: FeedFilteredFormatModel = {
    find: jest.fn(),
  } as never;
  const failRecordModel: FailRecordModel = {
    findOne: jest.fn(),
  } as never;
  const discordApiService: DiscordAPIService = {
    getWebhook: jest.fn(),
  } as never;

  beforeEach(async () => {
    service = new LegacyFeedConversionService(
      profileModel,
      feedModel,
      feedSubscriberModel,
      feedFilteredFormatModel,
      failRecordModel,
      discordApiService
    );
  });

  describe("getUserFeedEquivalent", () => {
    const baseFeed: Feed = Object.freeze({
      _id: new Types.ObjectId(),
      title: "title",
      url: "url",
      guild: "guild",
      addedAt: new Date(),
      channel: "channel",
      embeds: [],
    });
    const data = {
      discordUserId: "123",
    };

    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(discordApiService, "getWebhook").mockResolvedValue({
        id: "123",
        token: "token",
      } as never);
    });

    it("converts ncomparisons correctly", async () => {
      const input: Feed = {
        ...baseFeed,
        ncomparisons: ["a", "b"],
      };

      await expect(
        service.getUserFeedEquivalent(input, data)
      ).resolves.toMatchObject({
        blockingComparisons: ["a", "b"],
      });
    });

    it("converts pcomparisons correctly", async () => {
      const input: Feed = {
        ...baseFeed,
        pcomparisons: ["a", "b"],
      };

      await expect(
        service.getUserFeedEquivalent(input, data)
      ).resolves.toMatchObject({
        passingComparisons: ["a", "b"],
      });
    });

    it("sets created and updated dates correctly", async () => {
      const input: Feed = {
        ...baseFeed,
        createdAt: new Date("2021-01-01"),
        updatedAt: new Date("2021-01-02"),
      };

      await expect(
        service.getUserFeedEquivalent(input, data)
      ).resolves.toMatchObject({
        createdAt: new Date("2021-01-01"),
        updatedAt: new Date("2021-01-02"),
      });
    });

    describe("date format", () => {
      it("sets date format when defined", async () => {
        jest.spyOn(profileModel, "findById").mockResolvedValue({
          dateFormat: "dateFormat",
        } as never);

        await expect(
          service.getUserFeedEquivalent(baseFeed, data)
        ).resolves.toMatchObject({
          formatOptions: {
            dateFormat: "dateFormat",
          },
        });
      });

      it("sets date format to undefined when not defined", async () => {
        jest.spyOn(profileModel, "findById").mockResolvedValue({
          dateFormat: undefined,
        } as never);

        await expect(
          service.getUserFeedEquivalent(baseFeed, data)
        ).resolves.toMatchObject({
          formatOptions: {
            dateFormat: undefined,
          },
        });
      });
    });

    describe("date timezone", () => {
      it("sets correctly when defined", async () => {
        jest.spyOn(profileModel, "findById").mockResolvedValue({
          timezone: "timezone",
        } as never);

        await expect(
          service.getUserFeedEquivalent(baseFeed, data)
        ).resolves.toMatchObject({
          formatOptions: {
            dateTimezone: "timezone",
          },
        });
      });

      it("sets to undefined when not defined", async () => {
        jest.spyOn(profileModel, "findById").mockResolvedValue({
          timezone: undefined,
        } as never);

        await expect(
          service.getUserFeedEquivalent(baseFeed, data)
        ).resolves.toMatchObject({
          formatOptions: {
            dateTimezone: undefined,
          },
        });
      });
    });

    it("sets title correctly", async () => {
      const feed = {
        ...baseFeed,
        title: "new title",
      };

      await expect(
        service.getUserFeedEquivalent(feed, data)
      ).resolves.toMatchObject({
        title: "new title",
      });
    });

    it("sets url correctly", async () => {
      const feed = {
        ...baseFeed,
        url: "new url",
      };

      await expect(
        service.getUserFeedEquivalent(feed, data)
      ).resolves.toMatchObject({
        url: "new url",
      });
    });

    it("sets user correctly", async () => {
      await expect(
        service.getUserFeedEquivalent(baseFeed, data)
      ).resolves.toMatchObject({
        user: {
          discordUserId: data.discordUserId,
        },
      });
    });

    describe("channel connections", () => {
      it("creates a channel connection if there is no webhook", async () => {
        const result = await service.getUserFeedEquivalent(baseFeed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                details: {
                  channel: {
                    id: baseFeed.channel,
                    guildId: baseFeed.guild,
                  },
                },
              },
            ],
          },
        });
      });

      it("sets split options correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
          split: {
            enabled: true,
          },
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                splitOptions: {
                  isEnabled: true,
                },
              },
            ],
          },
        });
      });

      it("sets content correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
          text: "hello world",
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                details: {
                  content: "hello world",
                },
              },
            ],
          },
        });
      });

      describe("format tables", () => {
        it("sets correctly when true", async () => {
          const feed: Feed = {
            ...baseFeed,
            formatTables: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      formatTables: true,
                    },
                  },
                },
              ],
            },
          });
        });

        it("sets correctly when false", async () => {
          const feed: Feed = {
            ...baseFeed,
            formatTables: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      formatTables: false,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      describe("strip images", () => {
        it("sets correctly when tru", async () => {
          const feed: Feed = {
            ...baseFeed,
            imgLinksExistence: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      stripImages: true,
                    },
                  },
                },
              ],
            },
          });
        });

        it("sets correctly when false", async () => {
          const feed: Feed = {
            ...baseFeed,
            imgLinksExistence: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      stripImages: false,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      it("sets createdAt correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
          createdAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                createdAt: new Date("2020-01-01"),
              },
            ],
          },
        });
      });

      it("sets updatedAt correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
          updatedAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                updatedAt: new Date("2020-01-01"),
              },
            ],
          },
        });
      });
    });

    describe("webhook connections", () => {
      const baseWebhookFeed = {
        ...baseFeed,
        webhook: {
          id: "1",
          avatar: "avatar",
          name: "name",
          url: "url",
        },
      };

      it("sets the details correctly if a webhook exists", async () => {
        jest.spyOn(discordApiService, "getWebhook").mockResolvedValue({
          token: "token",
        } as never);

        const result = await service.getUserFeedEquivalent(
          baseWebhookFeed,
          data
        );

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                details: {
                  webhook: {
                    id: "1",
                    guildId: baseFeed.guild,
                    name: "name",
                    iconUrl: "avatar",
                    token: "token",
                  },
                },
              },
            ],
          },
        });
      });

      it("sets split options correctly", async () => {
        const feed: Feed = {
          ...baseWebhookFeed,
          split: {
            enabled: true,
          },
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                splitOptions: {
                  isEnabled: true,
                },
              },
            ],
          },
        });
      });

      it("sets content correctly", async () => {
        const feed: Feed = {
          ...baseWebhookFeed,
          text: "hello world",
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                details: {
                  content: "hello world",
                },
              },
            ],
          },
        });
      });

      describe("format tables", () => {
        it("sets correctly when true", async () => {
          const feed: Feed = {
            ...baseWebhookFeed,
            formatTables: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      formatTables: true,
                    },
                  },
                },
              ],
            },
          });
        });

        it("sets correctly when false", async () => {
          const feed: Feed = {
            ...baseWebhookFeed,
            formatTables: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      formatTables: false,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      describe("strip images", () => {
        it("sets correctly when true", async () => {
          const feed: Feed = {
            ...baseWebhookFeed,
            imgLinksExistence: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      stripImages: true,
                    },
                  },
                },
              ],
            },
          });
        });

        it("sets correctly when false", async () => {
          const feed: Feed = {
            ...baseWebhookFeed,
            imgLinksExistence: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      stripImages: false,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      it("sets createdAt correctly", async () => {
        const feed: Feed = {
          ...baseWebhookFeed,
          createdAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                createdAt: new Date("2020-01-01"),
              },
            ],
          },
        });
      });

      it("sets updatedAt correctly", async () => {
        const feed: Feed = {
          ...baseWebhookFeed,
          updatedAt: new Date("2020-01-01"),
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                updatedAt: new Date("2020-01-01"),
              },
            ],
          },
        });
      });
    });
  });

  describe("getHealthStatus", () => {
    it("returns ok if there is no fail record", () => {
      expect(service.getHealthStatus()).toEqual(UserFeedHealthStatus.Ok);
    });

    it("returns failed if the fail record is older than 3 days", () => {
      expect(
        service.getHealthStatus({
          failedAt: dayjs().subtract(4, "day").toDate(),
        } as never)
      ).toEqual(UserFeedHealthStatus.Failed);
    });

    it("returns failing if the fail record is newer than 3 days", () => {
      expect(
        service.getHealthStatus({
          failedAt: dayjs().subtract(2, "day").toDate(),
        } as never)
      ).toEqual(UserFeedHealthStatus.Failing);
    });
  });

  describe("convertPlaceholders", () => {
    it("converts single-brace placehodlers to double brace", () => {
      expect(
        service.convertPlaceholders(
          "test {placeholder}\n\n{placeholder2} {{placehodler3}}"
        )
      ).toEqual("test {{placeholder}}\n\n{{placeholder2}} {{{placehodler3}}}");
    });

    it("returns undefined if undefined is passed", () => {
      expect(service.convertPlaceholders(undefined)).toBeUndefined();
    });
  });

  describe("convertEmbeds", () => {
    it("converts embeds including placehodlers", () => {
      const input: Feed["embeds"] = [
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

      expect(service.convertEmbeds(input)).toEqual([
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
  });

  describe("convertRegexFilters", () => {
    it("converts correctly", () => {
      const filters: Feed["rfilters"] = {
        title: "myregex",
        description: "myregex2",
      };

      expect(service.convertRegexFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "OR",
          children: [
            {
              left: {
                type: "ARTICLE",
                value: "title",
              },
              op: "CONTAINS",
              right: {
                type: "REGEXP",
                value: "myregex",
              },
            },
            {
              left: {
                type: "ARTICLE",
                value: "description",
              },
              op: "CONTAINS",
              right: {
                type: "REGEXP",
                value: "myregex2",
              },
            },
          ],
        },
      });
    });

    it("handles raw categories by removing raw: prefix", () => {
      const filters: Feed["rfilters"] = {
        "raw:category": "myregex",
      };

      expect(service.convertRegexFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "OR",
          children: [
            {
              left: {
                type: "ARTICLE",
                value: "category",
              },
              op: "CONTAINS",
              right: {
                type: "REGEXP",
                value: "myregex",
              },
            },
          ],
        },
      });
    });

    it("returns undefined if undefined is passed", () => {
      expect(service.convertRegexFilters(undefined)).toBeUndefined();
    });

    it("returns undefined if empty object is passed", () => {
      expect(service.convertRegexFilters({})).toBeUndefined();
    });
  });

  describe("convertRegularFilters", () => {
    it("converts broad filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["~filter1"],
        description: ["~filter2"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [
                {
                  left: {
                    type: "ARTICLE",
                    value: "title",
                  },
                  op: "CONTAINS",
                  right: {
                    type: "STRING",

                    value: "filter1",
                  },
                },
                {
                  left: {
                    type: "ARTICLE",
                    value: "description",
                  },
                  op: "CONTAINS",
                  right: {
                    type: "STRING",
                    value: "filter2",
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it("converts regular filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["filter1"],
        description: ["filter2"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [
                {
                  left: {
                    type: "ARTICLE",
                    value: "title",
                  },
                  op: "EQ",
                  right: {
                    type: "STRING",
                    value: "filter1",
                  },
                },
                {
                  left: {
                    type: "ARTICLE",
                    value: "description",
                  },
                  op: "EQ",
                  right: {
                    type: "STRING",
                    value: "filter2",
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it("converts negated filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["!filter1"],
        description: ["!filter2"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [],
            },
            {
              type: "RELATIONAL",
              op: "NOT_EQ",
              left: {
                type: "ARTICLE",
                value: "title",
              },
              right: {
                type: "STRING",
                value: "filter1",
              },
            },
            {
              type: "RELATIONAL",
              op: "NOT_EQ",
              left: {
                type: "ARTICLE",
                value: "description",
              },
              right: {
                type: "STRING",
                value: "filter2",
              },
            },
          ],
        },
      });
    });

    it("converts broad negated filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["!~filter1"],
        description: ["~!filter2"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [],
            },
            {
              type: "RELATIONAL",
              op: "NOT_CONTAIN",
              left: {
                type: "ARTICLE",
                value: "title",
              },
              right: {
                type: "STRING",
                value: "filter1",
              },
            },
            {
              type: "RELATIONAL",
              op: "NOT_CONTAIN",
              left: {
                type: "ARTICLE",
                value: "description",
              },
              right: {
                type: "STRING",
                value: "filter2",
              },
            },
          ],
        },
      });
    });

    it("converts combination of negated and non-negated filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["!~filter1", "~filter4"],
        description: ["filter2", "!filter3"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [
                {
                  left: {
                    type: "ARTICLE",
                    value: "title",
                  },
                  op: "CONTAINS",
                  right: {
                    type: "STRING",
                    value: "filter4",
                  },
                },
                {
                  left: {
                    type: "ARTICLE",
                    value: "description",
                  },
                  op: "EQ",
                  right: {
                    type: "STRING",
                    value: "filter2",
                  },
                },
              ],
            },
            {
              type: "RELATIONAL",
              op: "NOT_CONTAIN",
              left: {
                type: "ARTICLE",
                value: "title",
              },
              right: {
                type: "STRING",
                value: "filter1",
              },
            },
            {
              type: "RELATIONAL",
              op: "NOT_EQ",
              left: {
                type: "ARTICLE",
                value: "description",
              },
              right: {
                type: "STRING",
                value: "filter3",
              },
            },
          ],
        },
      });
    });

    it("removes raw: from filter categories", () => {
      const filters: Feed["filters"] = {
        "raw:title": ["filter1"],
      };

      expect(service.convertRegularFilters(filters)).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              type: "LOGICAL",
              op: "OR",
              children: [
                {
                  left: {
                    type: "ARTICLE",
                    value: "title",
                  },
                  op: "EQ",
                  right: {
                    type: "STRING",
                    value: "filter1",
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it("returns undefined if undefined is passed", () => {
      expect(service.convertRegularFilters(undefined)).toBeUndefined();
    });

    it("returns undefined if empty object is passed", () => {
      expect(service.convertRegularFilters({})).toBeUndefined();
    });
  });
});
