import { DeliveryMedium } from "./delivery-medium.interface";
import { Injectable } from "@nestjs/common";
import { Article, DiscordMediumPayload } from "../../shared";

@Injectable()
export class DiscordMediumService implements DeliveryMedium {
  async deliver(details: {
    articles: Article[];
    feedDetails: {
      id: string;
      url: string;
      passingComparisons: string[];
      blockingComparisons: string[];
    };
    deliverySettings: DiscordMediumPayload["details"];
  }): Promise<void> {}
}
