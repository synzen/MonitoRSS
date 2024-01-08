import { FastifyRequest } from "fastify";
import { Types } from "mongoose";
import { GetFeedDiscordChannelConnectionPipe } from ".";
import { FeedConnectionNotFoundException } from "../exceptions";

describe("GetFeedDiscordChannelConnection", () => {
  let pipe: GetFeedDiscordChannelConnectionPipe;
  let request: FastifyRequest;

  beforeEach(() => {
    request = {
      params: {
        connectionId: "123",
      },
    } as never;
    pipe = new GetFeedDiscordChannelConnectionPipe(request);
  });

  it("throws an error if connection id does not exist in params", () => {
    request.params = {};
    expect(() => pipe.transform([{} as never])).toThrowError(Error);
  });

  it("throws not found if connection is not found", () => {
    const feed = {
      connections: {
        discordChannels: [],
      },
    };
    expect(() => pipe.transform([feed as never])).toThrowError(
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
        discordChannels: [connection],
      },
    };
    expect(pipe.transform([feed as never])).toEqual([{ feed, connection }]);
  });
});
