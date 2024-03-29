import { PipeTransform, Injectable, Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { DiscordWebhookConnection } from "../../feeds/entities/feed-connections";
import { UserFeed } from "../../user-feeds/entities";
import { FeedConnectionNotFoundException } from "../exceptions";

export interface GetFeedDiscordWebhookConnectionPipeOutput {
  feed: UserFeed;
  connection: DiscordWebhookConnection;
}

@Injectable({
  scope: Scope.REQUEST,
})
export class GetFeedDiscordWebhookConnectionPipe implements PipeTransform {
  constructor(@Inject(REQUEST) private readonly request: FastifyRequest) {}

  transform(feed: UserFeed): GetFeedDiscordWebhookConnectionPipeOutput {
    const { connectionId } = this.request.params as Record<string, string>;

    if (!connectionId) {
      throw new Error("connectionId is missing in request params");
    }

    const connection = feed.connections.discordWebhooks.find((connection) =>
      connection.id.equals(connectionId)
    );

    if (!connection) {
      throw new FeedConnectionNotFoundException(
        `Connection ${connectionId} not found`
      );
    }

    return { feed, connection };
  }
}
