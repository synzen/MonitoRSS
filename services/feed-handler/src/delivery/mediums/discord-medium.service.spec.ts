import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { DeliveryDetails } from "../types";
import { DiscordMediumService } from "./discord-medium.service";

jest.mock("@synzen/discord-rest", () => ({
  RESTProducer: jest.fn(),
}));

const botToken = "bot-token";
const clientId = "client-id";
const rabbitMqUri = "rabbit-mq-uri";
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
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscordMediumService>(DiscordMediumService);
    service.botToken = botToken;
    service.clientId = clientId;
    service.rabbitMqUri = rabbitMqUri;
    service.producer = producer as never;
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("deliver", () => {
    const deliveryDetails: DeliveryDetails = {
      articles: [
        {
          id: "1",
        },
      ],
      deliverySettings: {
        guildId: "guild-id",
        channels: [{ id: "channel-1" }, { id: "channel-2" }],
        webhooks: [
          {
            id: "webhook-id-1",
            token: "webhook-token-1",
          },
          {
            id: "webhook-id-2",
            token: "webhook-token-2",
          },
        ],
        content: "content",
      },
      feedDetails: {
        id: "feed-id",
        blockingComparisons: [],
        passingComparisons: [],
        url: "url",
      },
    };

    describe("channels", () => {
      it("should call the producer for every channel", async () => {
        await service.deliver(deliveryDetails);

        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/channels/channel-1/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            channel: "channel-1",
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
          }
        );

        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/channels/channel-2/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            channel: "channel-2",
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const details: DeliveryDetails = {
          ...deliveryDetails,
          articles: [
            {
              id: "1",
              title: "some-title-here",
            },
          ],
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
          },
        };
        await service.deliver(details);

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

    describe("webhooks", () => {
      it("should call the producer for every webhook", async () => {
        await service.deliver(deliveryDetails);

        const webhook1Id = deliveryDetails.deliverySettings.webhooks?.[0].id;
        const webhook1Token =
          deliveryDetails.deliverySettings.webhooks?.[0].token;
        const webhook2Id = deliveryDetails.deliverySettings.webhooks?.[1].id;
        const webhook2Token =
          deliveryDetails.deliverySettings.webhooks?.[1].token;
        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/webhooks/${webhook1Id}/${webhook1Token}`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            webhookId: webhook1Id,
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
          }
        );

        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/webhooks/${webhook2Id}/${webhook2Token}`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
            }),
          },
          {
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            webhookId: webhook2Id,
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const details: DeliveryDetails = {
          ...deliveryDetails,
          articles: [
            {
              id: "1",
              title: "some-title-here",
            },
          ],
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
          },
        };
        await service.deliver(details);

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
  });
});
