import { Test, TestingModule } from "@nestjs/testing";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
} from "../types";
import { DiscordMediumService } from "./discord-medium.service";

jest.mock("@synzen/discord-rest", () => ({
  RESTProducer: jest.fn(),
}));

const producer = {
  enqueue: jest.fn(),
};

describe("DiscordMediumService", () => {
  let service: DiscordMediumService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordMediumService,
        {
          provide: "DISCORD_REST_PRODUCER",
          useValue: producer,
        },
      ],
    }).compile();

    service = module.get<DiscordMediumService>(DiscordMediumService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation();
  });

  describe("deliverArticle", () => {
    const article = {
      id: "1",
    };

    const deliveryDetails: DeliveryDetails = {
      deliveryId: "delivery-id",
      mediumId: "medium-id",
      deliverySettings: {
        guildId: "guild-id",
        channel: { id: "channel-1" },
        webhook: {
          id: "webhook-id-1",
          token: "webhook-token-1",
        },
        content: "content",
      },
      feedDetails: {
        id: "feed-id",
        blockingComparisons: [],
        passingComparisons: [],
        url: "url",
      },
    };

    it("returns the status of the result", async () => {
      const result = await service.deliverArticle(article, deliveryDetails);
      expect(result).toEqual({
        id: deliveryDetails.deliveryId,
        mediumId: deliveryDetails.mediumId,
        status: ArticleDeliveryStatus.PendingDelivery,
      });
    });

    it("sends embeds", async () => {
      const detailsWithEmbeds: DeliveryDetails = {
        ...deliveryDetails,
        deliverySettings: {
          ...deliveryDetails.deliverySettings,
          embeds: [
            {
              author: {
                name: "author-name",
                iconUrl: "author-icon-url",
              },
              footer: {
                text: "footer-text",
                iconUrl: "footer-icon-url",
              },
              image: {
                url: "image-url",
              },
              thumbnail: {
                url: "thumbnail-url",
              },
              title: "title",
              description: "description",
              url: "url",
              color: 123,
              fields: [
                {
                  name: "name",
                  value: "value",
                  inline: true,
                },
              ],
            },
          ],
        },
      };

      await service.deliverArticle(article, detailsWithEmbeds);
      const callBody = JSON.parse(producer.enqueue.mock.calls[0][1].body);
      expect(callBody).toMatchObject({
        embeds: [
          {
            author: {
              name: "author-name",
              icon_url: "author-icon-url",
            },
            footer: {
              text: "footer-text",
              icon_url: "footer-icon-url",
            },
            image: {
              url: "image-url",
            },
            thumbnail: {
              url: "thumbnail-url",
            },
            title: "title",
            description: "description",
            url: "url",
            color: 123,
            fields: [
              {
                name: "name",
                value: "value",
                inline: true,
              },
            ],
          },
        ],
      });
    });

    describe("channel", () => {
      it("should call the producer for the channel", async () => {
        await service.deliverArticle(article, {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            webhook: null,
          },
        });

        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/channels/channel-1/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            id: deliveryDetails.deliveryId,
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            channel: "channel-1",
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
            emitDeliveryResult: true,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          id: "1",
          title: "some-title-here",
        };
        const details: DeliveryDetails = {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
            webhook: null,
          },
        };
        await service.deliverArticle(article, details);

        expect(producer.enqueue).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
            }),
          }),
          expect.anything()
        );
      });
    });

    describe("webhook", () => {
      it("prioritizes webhook over channel, calls the producer for the webhook", async () => {
        await service.deliverArticle(article, deliveryDetails);

        const webhook1Id = deliveryDetails.deliverySettings.webhook?.id;
        const webhook1Token = deliveryDetails.deliverySettings.webhook?.token;
        deliveryDetails.deliverySettings.webhook?.token;
        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/webhooks/${webhook1Id}/${webhook1Token}`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            id: deliveryDetails.deliveryId,
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            webhookId: webhook1Id,
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
            emitDeliveryResult: true,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          id: "1",
          title: "some-title-here",
        };
        const details: DeliveryDetails = {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
          },
        };
        await service.deliverArticle(article, details);

        expect(producer.enqueue).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
            }),
          }),
          expect.anything()
        );
      });

      it("returns the correct result for job response %o", () => {
        return expect(
          service.deliverArticle(article, deliveryDetails)
        ).resolves.toEqual({
          id: deliveryDetails.deliveryId,
          status: ArticleDeliveryStatus.PendingDelivery,
          mediumId: deliveryDetails.mediumId,
        } as ArticleDeliveryState);
      });
    });
  });
});
