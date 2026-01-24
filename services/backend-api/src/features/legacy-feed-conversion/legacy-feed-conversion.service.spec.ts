/* eslint-disable max-len */
import dayjs from "dayjs";
import { Types } from "mongoose";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordServerProfileModel } from "../discord-servers/entities";
import { FailRecordModel } from "../feeds/entities/fail-record.entity";
import { FeedFilteredFormatModel } from "../feeds/entities/feed-filtered-format.entity";
import {
  FeedSubscriber,
  FeedSubscriberModel,
} from "../feeds/entities/feed-subscriber.entity";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { UserFeedLimitOverrideModel } from "../supporters/entities/user-feed-limit-overrides.entity";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeedModel } from "../user-feeds/entities";
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
  const userFeedModel: UserFeedModel = {
    countDocuments: jest.fn(),
    create: jest.fn(),
  } as never;
  const discordApiService: DiscordAPIService = {
    getWebhook: jest.fn(),
  } as never;
  const supportersService: SupportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
  } as never;
  const userFeedLimitOverrideModel: UserFeedLimitOverrideModel = {
    findById: jest.fn(),
    create: jest.fn(),
  } as never;

  beforeEach(async () => {
    service = new LegacyFeedConversionService(
      profileModel,
      feedModel,
      feedSubscriberModel,
      feedFilteredFormatModel,
      failRecordModel,
      userFeedModel,
      userFeedLimitOverrideModel,
      discordApiService,
      supportersService
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
      subscribers: [
        {
          id: "1",
          type: "role",
          filters: {
            tags: ["tag1"],
          },
          feed: baseFeed._id,
          _id: new Types.ObjectId(),
        } as FeedSubscriber,
      ],
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

    describe("check dates", () => {
      it("sets date check options when defined", async () => {
        await expect(
          service.getUserFeedEquivalent(
            {
              ...baseFeed,
              checkDates: true,
            },
            {
              ...data,
            } as never
          )
        ).resolves.toMatchObject({
          dateCheckOptions: {
            oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
          },
        });
      });
    });

    describe("date format", () => {
      it("sets date format when defined", async () => {
        await expect(
          service.getUserFeedEquivalent(baseFeed, {
            ...data,
            profile: {
              dateFormat: "dateFormat",
            },
          } as never)
        ).resolves.toMatchObject({
          formatOptions: {
            dateFormat: "dateFormat",
          },
        });
      });

      it("sets date format to undefined when not defined", async () => {
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
        await expect(
          service.getUserFeedEquivalent(baseFeed, {
            ...data,
            profile: {
              timezone: "timezone",
            },
          } as never)
        ).resolves.toMatchObject({
          formatOptions: {
            dateTimezone: "timezone",
          },
        });
      });

      it("sets to undefined when not defined", async () => {
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
      it("adds placeholder limits", async () => {
        const result = await service.getUserFeedEquivalent(baseFeed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                details: {
                  placeholderLimits: [
                    {
                      characterCount: 790,
                      placeholder: "summary",
                      appendString: "...",
                    },
                    {
                      characterCount: 790,
                      placeholder: "description",
                      appendString: "...",
                    },
                    {
                      characterCount: 150,
                      placeholder: "title",
                      appendString: "...",
                    },
                  ],
                },
              },
            ],
          },
        });
      });

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

      it("sets custom placeholders correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
          split: {
            enabled: true,
          },
          regexOps: {
            title: [
              {
                name: "mytitle",
                search: {
                  regex: "myregex",
                },
                replacement: "myreplacement",
                replacementDirect: "myreplacementdirect",
              },
              {
                name: "mytitle",
                search: {
                  regex: "myregex2",
                },
                replacement: "myreplacement2",
              },
            ],
            description: [
              {
                name: "mydescription",
                search: {
                  regex: "myregex",
                },
                replacement: "myreplacement",
                replacementDirect: "myreplacementdirect2",
              },
              {
                name: "mydescription2",
                search: {
                  regex: "myregex2",
                },
                replacement: "myreplacement2",
              },
            ],
          },
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                customPlaceholders: [
                  {
                    id: `title::mytitle`,
                    referenceName: "mytitle",
                    sourcePlaceholder: "title",
                    steps: [
                      {
                        id: expect.any(String),
                        regexSearch: "myregex",
                        replacementString: "myreplacementdirect",
                      },
                      {
                        id: expect.any(String),
                        regexSearch: "myregex2",
                        replacementString: "myreplacement2",
                      },
                    ],
                  },
                  {
                    id: "description::mydescription",
                    referenceName: "mydescription",
                    sourcePlaceholder: "description",
                    steps: [
                      {
                        id: expect.any(String),
                        regexSearch: "myregex",
                        replacementString: "myreplacementdirect2",
                      },
                    ],
                  },
                  {
                    id: "description::mydescription2",
                    referenceName: "mydescription2",
                    sourcePlaceholder: "description",
                    steps: [
                      {
                        id: expect.any(String),
                        regexSearch: "myregex2",
                        replacementString: "myreplacement2",
                      },
                    ],
                  },
                ],
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

      it("sets mentions correctly", async () => {
        const feed: Feed = {
          ...baseFeed,
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordChannels: [
              {
                mentions: {
                  targets: [
                    {
                      id: "1",
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
                                  left: {
                                    type: "ARTICLE",
                                    value: "processed::categories",
                                  },
                                  right: {
                                    type: "STRING",
                                    value: "tag1",
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  ],
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
        it("sets correctly when true", async () => {
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
                      stripImages: false,
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
                      stripImages: true,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      describe("image links preview", () => {
        it("sets correctly when true", async () => {
          const feed: Feed = {
            ...baseFeed,
            imgPreviews: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      disableImageLinkPreviews: false,
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
            imgPreviews: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordChannels: [
                {
                  details: {
                    formatter: {
                      disableImageLinkPreviews: true,
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

      it("adds placeholder limits", async () => {
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
                  placeholderLimits: [
                    {
                      characterCount: 790,
                      placeholder: "summary",
                      appendString: "...",
                    },
                    {
                      characterCount: 790,
                      placeholder: "description",
                      appendString: "...",
                    },
                    {
                      characterCount: 150,
                      placeholder: "title",
                      appendString: "...",
                    },
                  ],
                },
              },
            ],
          },
        });
      });

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

      it("sets mentions correctly", async () => {
        const feed: Feed = {
          ...baseWebhookFeed,
        };

        const result = await service.getUserFeedEquivalent(feed, data);

        expect(result).toMatchObject({
          connections: {
            discordWebhooks: [
              {
                mentions: {
                  targets: [
                    {
                      id: "1",
                      type: "role",
                    },
                  ],
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
                      stripImages: false,
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
                      stripImages: true,
                    },
                  },
                },
              ],
            },
          });
        });
      });

      describe("image links preview", () => {
        it("sets correctly when true", async () => {
          const feed: Feed = {
            ...baseWebhookFeed,
            imgPreviews: true,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      disableImageLinkPreviews: false,
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
            imgPreviews: false,
          };

          const result = await service.getUserFeedEquivalent(feed, data);

          expect(result).toMatchObject({
            connections: {
              discordWebhooks: [
                {
                  details: {
                    formatter: {
                      disableImageLinkPreviews: true,
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
    it("converts regex placeholders", () => {
      expect(
        service.convertPlaceholders("test {title:custom}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [
            {
              regexOpPh: "title:custom",
              newPh: "custom::custom",
            },
          ],
        })
      ).toEqual("test {{custom::custom}}");
    });

    it("converts subscriptions placeholders", () => {
      expect(
        service.convertPlaceholders("test {subscriptions}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{discord::mentions}}");
    });

    it("converts subscribers placeholders", () => {
      expect(
        service.convertPlaceholders("test {subscribers}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{discord::mentions}}");
    });

    it("converts date placeholders", () => {
      expect(
        service.convertPlaceholders("test {date}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{pubdate}}");
    });

    it("converts single-brace placeholders to double brace", () => {
      expect(
        service.convertPlaceholders(
          "test {placeholder}\n\n{placeholder2} {{placehodler3}}",
          {
            isYoutube: false,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual("test {{placeholder}}\n\n{{placeholder2}} {{{placehodler3}}}");
    });

    it("returns undefined if undefined is passed", () => {
      expect(
        service.convertPlaceholders(undefined, {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toBeUndefined();
    });

    it("converts summary images", () => {
      expect(
        service.convertPlaceholders("test {summary:image1} {summary:image2}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual(
        "test {{extracted::summary::image1}} {{extracted::summary::image2}}"
      );
    });

    it("converts summary anchors", () => {
      expect(
        service.convertPlaceholders(
          "test {summary:anchor1} {summary:anchor2}",
          {
            isYoutube: false,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual(
        "test {{extracted::summary::anchor1}} {{extracted::summary::anchor2}}"
      );
    });

    it("converts description anchors", () => {
      expect(
        service.convertPlaceholders(
          "test {description:anchor1} {description:anchor2}",
          {
            isYoutube: false,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual(
        "test {{extracted::description::anchor1}} {{extracted::description::anchor2}}"
      );
    });

    it("converts description images", () => {
      expect(
        service.convertPlaceholders(
          "test {description:image1} {description:image2}",
          {
            isYoutube: false,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual(
        "test {{extracted::description::image1}} {{extracted::description::image2}}"
      );
    });

    it("converts title anchors", () => {
      expect(
        service.convertPlaceholders("test {title:anchor1} {title:anchor2}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual(
        "test {{extracted::title::anchor1}} {{extracted::title::anchor2}}"
      );
    });

    it("converts title images", () => {
      expect(
        service.convertPlaceholders("test {title:image1} {title:image2}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual(
        "test {{extracted::title::image1}} {{extracted::title::image2}}"
      );
    });

    it("converts raw placeholders", () => {
      expect(
        service.convertPlaceholders("test {raw:description}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description}}");
    });

    it("converts raw placeholders that are multiple levels deep", () => {
      expect(
        service.convertPlaceholders("test {raw:description_level1_level2}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description__level1__level2}}");
    });

    it("converts raw placeholders with dashes", () => {
      expect(
        service.convertPlaceholders("test {raw:description-is-here}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description:is:here}}");
    });

    it("converts raw placeholders with array indices", () => {
      expect(
        service.convertPlaceholders("test {raw:description[1]}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description__1}}");
    });

    it("converts raw placeholders with array indices multiple levels deep", () => {
      expect(
        service.convertPlaceholders("test {raw:description_level1[1]_level2}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description__level1__1__level2}}");
    });

    it("converts raw placeholders with array indices and dashes", () => {
      expect(
        service.convertPlaceholders("test {raw:description-is-here[1]}", {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{description:is:here__1}}");
    });

    it("converts raw placeholders with array indices and dashes multiple levels deep", () => {
      expect(
        service.convertPlaceholders(
          "test {raw:description_level1-is-here[1]_level2}",
          {
            isYoutube: false,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual("test {{description__level1:is:here__1__level2}}");
    });

    it("converts descriptions for youtube feeds", () => {
      expect(
        service.convertPlaceholders("test {description}", {
          isYoutube: true,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual("test {{media:group__media:description__#}}");
    });

    it("converts fallback placeholders with image URLs", () => {
      expect(
        service.convertPlaceholders(
          "test {item1||item2||https://image.com||http://image.com}",
          {
            isYoutube: true,
            regexPlaceholdersToReplace: [],
          }
        )
      ).toEqual(
        "test {{item1||item2||text::https://image.com||text::http://image.com}}"
      );
    });
  });

  describe("convertEmbeds", () => {
    it("converts embeds including placeholders", () => {
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

      expect(
        service.convertEmbeds(input, {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual([
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
      const input: Feed["embeds"] = [
        {
          title: "title {placeholder}",
          description: "description {placeholder}",
          url: "url {placeholder}",
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

      expect(
        service.convertEmbeds(input, {
          isYoutube: false,
          regexPlaceholdersToReplace: [],
        })
      ).toEqual([
        {
          title: "title {{placeholder}}",
          description: "description {{placeholder}}",
          url: "url {{placeholder}}",
          color: undefined,
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
              op: "MATCHES",
              right: {
                type: "STRING",
                value: "myregex",
              },
            },
            {
              left: {
                type: "ARTICLE",
                value: "description",
              },
              op: "MATCHES",
              right: {
                type: "STRING",
                value: "myregex2",
              },
            },
          ],
        },
      });
    });

    it("converts inverted correctly", () => {
      const filters: Feed["rfilters"] = {
        title: "myregex",
        description: "myregex2",
      };

      expect(
        service.convertRegexFilters(filters, {
          invert: true,
        })
      ).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "AND",
          children: [
            {
              left: {
                type: "ARTICLE",
                value: "title",
              },
              op: "MATCHES",
              not: true,
              right: {
                type: "STRING",
                value: "myregex",
              },
            },
            {
              left: {
                type: "ARTICLE",
                value: "description",
              },
              op: "MATCHES",
              not: true,
              right: {
                type: "STRING",
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
              op: "MATCHES",
              right: {
                type: "STRING",
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
              op: "EQ",
              not: true,
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
              op: "EQ",
              not: true,
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
              op: "CONTAINS",
              not: true,
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
              op: "CONTAINS",
              not: true,
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
              op: "CONTAINS",
              not: true,
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
              op: "EQ",
              not: true,
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

    it("converts inverted combination of negated and non-negated filters correctly", () => {
      const filters: Feed["filters"] = {
        title: ["!~filter1", "~filter4"],
        description: ["filter2", "!filter3"],
      };

      expect(
        service.convertRegularFilters(filters, {
          invert: true,
        })
      ).toMatchObject({
        expression: {
          type: "LOGICAL",
          op: "OR",
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
                  not: true,
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
                  not: true,
                  right: {
                    type: "STRING",
                    value: "filter2",
                  },
                },
              ],
            },
            {
              type: "RELATIONAL",
              op: "CONTAINS",
              left: {
                type: "ARTICLE",
                value: "title",
              },
              not: false,
              right: {
                type: "STRING",
                value: "filter1",
              },
            },
            {
              type: "RELATIONAL",
              op: "EQ",
              left: {
                type: "ARTICLE",
                value: "description",
              },
              not: false,
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
