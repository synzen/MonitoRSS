import { DiscordAPIError } from "../../../common/errors/DiscordAPIError";
import { DiscordAPIService } from "./discord-api.service";

jest.mock("@synzen/discord-rest");

describe("DiscordAPIService", () => {
  let discordApi: DiscordAPIService;
  const configService = {
    get: jest.fn(),
  };
  const restHandler = {
    fetch: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discordApi = new DiscordAPIService(configService as any);
    discordApi.restHandler = restHandler as never;
  });

  describe("executeBotRequest", () => {
    it("throws an error if status code is not ok", async () => {
      const endpoint = `/guilds/123456789/members/123456789`;

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(discordApi.executeBotRequest(endpoint)).rejects.toThrow(
        DiscordAPIError
      );
    });

    it("returns the response", async () => {
      const endpoint = `/guilds/123456789/members/123456789`;

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({
          message: "Success",
        }),
      });

      const response = await discordApi.executeBotRequest(endpoint);
      expect(response).toEqual({
        message: "Success",
      });
    });
  });

  describe("executeBearerRequest", () => {
    it("throws an error if status code is not ok", async () => {
      const accessToken = "mock-access-token";
      const endpoint = `/guilds/123456789/members/123456789`;

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({
          message: "Internal server error",
        }),
      });

      await expect(
        discordApi.executeBearerRequest(accessToken, endpoint)
      ).rejects.toThrow(DiscordAPIError);
    });

    it("returns the response", async () => {
      const accessToken = "mock-access-token";
      const endpoint = `/guilds/123456789/members/123456789`;

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({
          message: "Success",
        }),
      });

      const response = await discordApi.executeBearerRequest(
        accessToken,
        endpoint
      );
      expect(response).toEqual({
        message: "Success",
      });
    });
  });

  describe("getBot", () => {
    it("returns the bot", async () => {
      const botClientId = "123456789";

      jest.spyOn(configService, "get").mockImplementation((key) => {
        if (key === "BACKEND_API_DISCORD_CLIENT_ID") {
          return botClientId;
        }

        return undefined;
      });

      const discordUser = {
        id: "user-id",
      };

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue(discordUser),
      });

      const response = await discordApi.getBot();
      expect(response).toEqual(discordUser);
    });
  });

  describe("getWebhook", () => {
    it("calls the correct endpoint", async () => {
      const webhookId = "123456789";

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      await discordApi.getWebhook(webhookId);

      expect(restHandler.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v9/webhooks/${webhookId}`,
        {
          method: "GET",
          headers: expect.objectContaining({
            Authorization: `Bot ${discordApi.BOT_TOKEN}`,
            "Content-Type": "application/json",
          }),
        }
      );
    });

    it("returns the json", async () => {
      const webhookId = "123456789";

      const webhook = {
        id: webhookId,
      };

      jest.spyOn(restHandler, "fetch").mockResolvedValue({
        status: 200,
        json: jest.fn().mockResolvedValue(webhook),
      });

      const response = await discordApi.getWebhook(webhookId);
      expect(response).toEqual(webhook);
    });
  });
});
