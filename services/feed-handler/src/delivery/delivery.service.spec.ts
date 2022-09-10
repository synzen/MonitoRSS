import { Test, TestingModule } from "@nestjs/testing";
import { Article, FeedV2Event, MediumKey } from "../shared";
import { DeliveryService } from "./delivery.service";
import { DiscordMediumService } from "./mediums/discord-medium.service";

describe("DeliveryService", () => {
  let service: DeliveryService;
  const discordMediumService = {
    deliver: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        {
          provide: DiscordMediumService,
          useValue: discordMediumService,
        },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("deliver", () => {
    const event: FeedV2Event = {
      feed: {
        id: "1",
        url: "url",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [
        {
          key: MediumKey.Discord,
          details: {
            guildId: "1",
            channels: [{ id: "channel 1" }],
          },
        },
        {
          key: MediumKey.Discord,
          details: {
            guildId: "2",
            channels: [{ id: "channel 2" }],
          },
        },
      ],
    };
    const articles: Article[] = [
      {
        id: "article 1",
      },
      {
        id: "article 2",
      },
    ];

    it("calls deliver on the mediums", async () => {
      await service.deliver(event, articles);

      expect(discordMediumService.deliver).toHaveBeenCalledTimes(2);
      expect(discordMediumService.deliver).toHaveBeenCalledWith({
        articles,
        deliverySettings: event.mediums[0].details,
        feedDetails: event.feed,
      });
      expect(discordMediumService.deliver).toHaveBeenCalledWith({
        articles,
        deliverySettings: event.mediums[1].details,
        feedDetails: event.feed,
      });
    });

    it("logs errors if one medium fails", async () => {
      const deliveryError = new Error("delivery err");
      discordMediumService.deliver
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(deliveryError);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      await expect(service.deliver(event, articles)).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });
});
