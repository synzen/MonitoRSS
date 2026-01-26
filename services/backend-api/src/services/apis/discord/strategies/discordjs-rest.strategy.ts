import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { REST, DiscordAPIError, HTTPError, RequestData } from "@discordjs/rest";
import { DISCORD_API_BASE_URL } from "../../../../constants/discord";
import {
  DiscordRestRequestOptions,
  DiscordRestResponse,
  DiscordRestStrategy,
} from "./discord-rest-strategy.interface";

@Injectable()
export class DiscordjsRestStrategy implements DiscordRestStrategy {
  private rest: REST;

  constructor(private readonly configService: ConfigService) {
    const token = configService.get<string>(
      "BACKEND_API_DISCORD_BOT_TOKEN"
    ) as string;

    this.rest = new REST({ version: "10" }).setToken(token);
  }

  async fetch(
    url: string,
    options: DiscordRestRequestOptions
  ): Promise<DiscordRestResponse> {
    const endpoint = url.replace(DISCORD_API_BASE_URL, "") as `/${string}`;

    const isBearerAuth = options.headers?.Authorization?.startsWith("Bearer ");
    const bearerToken = isBearerAuth
      ? options.headers?.Authorization?.replace("Bearer ", "")
      : undefined;

    const requestData: RequestData = {
      body: options.body ? JSON.parse(options.body) : undefined,
      auth: !isBearerAuth,
      authPrefix: isBearerAuth ? ("Bearer" as const) : ("Bot" as const),
      headers: isBearerAuth
        ? { Authorization: `Bearer ${bearerToken}` }
        : undefined,
    };

    try {
      let result: unknown;

      switch (options.method) {
        case "GET":
          result = await this.rest.get(endpoint, requestData);
          break;
        case "POST":
          result = await this.rest.post(endpoint, requestData);
          break;
        case "PUT":
          result = await this.rest.put(endpoint, requestData);
          break;
        case "DELETE":
          result = await this.rest.delete(endpoint, requestData);
          break;
        case "PATCH":
          result = await this.rest.patch(endpoint, requestData);
          break;
      }

      return {
        status: 200,
        json: async <T>() => result as T,
      };
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        return {
          status: error.status,
          json: async <T>() => error.rawError as T,
        };
      }

      if (error instanceof HTTPError) {
        return {
          status: error.status,
          json: async <T>() => ({ message: error.message } as T),
        };
      }

      throw error;
    }
  }
}
