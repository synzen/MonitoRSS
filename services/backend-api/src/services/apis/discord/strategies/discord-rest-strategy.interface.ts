export interface DiscordRestResponse {
  status: number;
  json: <T>() => Promise<T>;
}

export interface DiscordRestRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
}

export interface DiscordRestStrategy {
  fetch(
    url: string,
    options: DiscordRestRequestOptions
  ): Promise<DiscordRestResponse>;
}

export const DISCORD_REST_STRATEGY = Symbol("DISCORD_REST_STRATEGY");
