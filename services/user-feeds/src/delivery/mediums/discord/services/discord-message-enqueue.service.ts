import { Injectable } from "@nestjs/common";
import { RESTProducer } from "@synzen/discord-rest";
import { ConfigService } from "@nestjs/config";
import { Article, ArticleDeliveryContentType } from "../../../../shared";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DiscordMessageApiPayload,
} from "../../../types";
import { generateDeliveryId } from "../../../../shared/utils/generate-delivery-id";

export interface EnqueueMessagesOptions {
  apiUrl: string;
  bodies: DiscordMessageApiPayload[];
  article: Article;
  mediumId: string;
  feedId: string;
  feedUrl: string;
  guildId: string;
  channelId?: string;
  webhookId?: string;
  parentDeliveryId?: string;
}

@Injectable()
export class DiscordMessageEnqueueService {
  private producer: RESTProducer;

  constructor(private readonly configService: ConfigService) {
    const rabbitmqUri = configService.getOrThrow(
      "USER_FEEDS_DISCORD_RABBITMQ_URI"
    );
    const discordClientId = configService.getOrThrow(
      "USER_FEEDS_DISCORD_CLIENT_ID"
    );

    this.producer = new RESTProducer(rabbitmqUri, {
      clientId: discordClientId,
    });
  }

  async close(): Promise<void> {
    await this.producer.close();
  }

  async enqueueMessages(
    options: EnqueueMessagesOptions
  ): Promise<ArticleDeliveryState[]> {
    const {
      apiUrl,
      bodies,
      article,
      mediumId,
      feedId,
      feedUrl,
      guildId,
      channelId,
      webhookId,
      parentDeliveryId: existingParentId,
    } = options;

    const deliveryStates: ArticleDeliveryState[] = [];
    const parentDeliveryId = existingParentId || generateDeliveryId();

    for (let idx = 0; idx < bodies.length; idx++) {
      const body = bodies[idx];
      const isFirst = idx === 0 && !existingParentId;
      const deliveryId = isFirst ? parentDeliveryId : generateDeliveryId();

      await this.producer.enqueue(
        apiUrl,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        {
          id: deliveryId,
          articleID: article.flattened.id,
          feedURL: feedUrl,
          ...(channelId ? { channel: channelId } : {}),
          ...(webhookId ? { webhookId } : {}),
          feedId,
          guildId,
          emitDeliveryResult: true,
        }
      );

      deliveryStates.push({
        id: deliveryId,
        status: ArticleDeliveryStatus.PendingDelivery,
        mediumId,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        articleIdHash: article.flattened.idHash,
        parent: isFirst ? undefined : parentDeliveryId,
        article,
      });
    }

    return deliveryStates;
  }
}
