import { FastifyRequest } from "fastify";
import { Types } from "mongoose";
import { FeedConnectionNotFoundException } from "../exceptions";
import { GetFeedDiscordWebhookConnectionPipe } from "./get-feed-discord-webhook-connection.pipe";

describe("GetFeedDiscordWebhookConnection", () => {
  let pipe: GetFeedDiscordWebhookConnectionPipe;
  let request: FastifyRequest;

  beforeEach(() => {
    request = {
      params: {
        connectionId: "123",
      },
    } as never;
    pipe = new GetFeedDiscordWebhookConnectionPipe(request);
  });

  it("throws an error if connection id does not exist in params", () => {
    request.params = {};
    expect(() => pipe.transform({} as never)).toThrowError(Error);
  });

  it("throws not found if connection is not found", () => {
    const feed = {
      connections: {
        discordWebhooks: [],
      },
    };
    expect(() => pipe.transform(feed as never)).toThrowError(
      FeedConnectionNotFoundException
    );
  });

  it("returns connection if found", () => {
    const connection = {
      id: new Types.ObjectId(),
    };

    (request.params as Record<string, string>).connectionId =
      connection.id.toHexString();

    const feed = {
      connections: {
        discordWebhooks: [connection],
      },
    };
    expect(pipe.transform(feed as never)).toEqual({ feed, connection });
  });
});
