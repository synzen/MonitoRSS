import { Injectable } from "@nestjs/common";
import { Article, FeedV2Event, MediumKey } from "../shared";
import { DeliveryMedium } from "./mediums/delivery-medium.interface";
import { DiscordMediumService } from "./mediums/discord-medium.service";

@Injectable()
export class DeliveryService {
  constructor(private readonly discordMediumService: DiscordMediumService) {}

  private mediumServices: Record<MediumKey, DeliveryMedium> = {
    [MediumKey.Discord]: this.discordMediumService,
  };

  async deliver(event: FeedV2Event, articles: Article[]) {
    await Promise.all(
      event.mediums.map(async (medium) => {
        try {
          await this.mediumServices[medium.key].deliver({
            articles,
            deliverySettings: medium.details,
            feedDetails: event.feed,
          });
        } catch (err) {
          console.error(
            `Failed to deliver event ${JSON.stringify(event)} to medium ${
              medium.key
            }`
          );
        }
      })
    );
  }
}
