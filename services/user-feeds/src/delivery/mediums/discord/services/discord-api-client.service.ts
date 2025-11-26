import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RESTHandler } from "@synzen/discord-rest";

export interface DiscordApiResponse {
  success: boolean;
  status: number;
  body: Record<string, unknown>;
  detail?: string;
}

@Injectable()
export class DiscordApiClientService {
  private static readonly BASE_API_URL = "https://discord.com/api/v10";
  private readonly handler: RESTHandler;
  private readonly botToken: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = configService.getOrThrow("USER_FEEDS_DISCORD_API_TOKEN");
    this.handler = new RESTHandler();
  }

  getChannelApiUrl(channelId: string): string {
    return `${DiscordApiClientService.BASE_API_URL}/channels/${channelId}/messages`;
  }

  getWebhookApiUrl(
    webhookId: string,
    webhookToken: string,
    queries?: {
      threadId?: string | null;
    }
  ): string {
    const urlQueries = new URLSearchParams();

    urlQueries.append("wait", "true");

    if (queries?.threadId) {
      urlQueries.append("thread_id", queries.threadId);
    }

    return `${
      DiscordApiClientService.BASE_API_URL
    }/webhooks/${webhookId}/${webhookToken}?${urlQueries.toString()}`;
  }

  getCreateChannelThreadUrl(channelId: string): string {
    return `${DiscordApiClientService.BASE_API_URL}/channels/${channelId}/threads`;
  }

  getCreateChannelMessageThreadUrl(
    channelId: string,
    messageId: string
  ): string {
    return (
      `${DiscordApiClientService.BASE_API_URL}` +
      `/channels/${channelId}/messages/${messageId}/threads`
    );
  }

  async sendRequest(
    url: string,
    { method, body }: { method: "POST"; body: object }
  ): Promise<DiscordApiResponse> {
    const res = await this.handler.fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${this.botToken}`,
      },
    });

    const isOkStatus = res.status >= 200 && res.status < 300;

    try {
      return {
        success: true,
        status: res.status,
        body: (await res.json()) as Record<string, unknown>,
        detail: !isOkStatus ? `Bad status code: ${res.status}` : undefined,
      };
    } catch (err) {
      return {
        success: false,
        status: res.status,
        detail: (err as Error).message,
        body: {},
      };
    }
  }
}
