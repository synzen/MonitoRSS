import type { Config } from "../../config";
import { RedditAppRevokedException } from "../../shared/exceptions";
import type { RedditAccessToken } from "./types";

export class RedditApiService {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;

  constructor(private readonly config: Config) {
    this.clientId = config.BACKEND_API_REDDIT_CLIENT_ID;
    this.clientSecret = config.BACKEND_API_REDDIT_CLIENT_SECRET;
    this.redirectUri = config.BACKEND_API_REDDIT_REDIRECT_URI;
  }

  getAuthorizeUrl(scopes = "read", state = "state") {
    if (!this.clientId) {
      throw new Error("Reddit client id not found");
    }

    if (!this.redirectUri) {
      throw new Error("Reddit redirect uri not found");
    }

    return `https://www.reddit.com/api/v1/authorize?client_id=${
      this.clientId
    }&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&duration=permanent&scope=${scopes}`;
  }

  async getAccessToken(authCode: string): Promise<RedditAccessToken> {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error("Reddit client id, secret, or redirect uri not found");
    }

    const data: Record<string, string> = {
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: this.redirectUri,
    };

    const form = Object.entries(data)
      .map(([key, value]) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(value);
      })
      .join("&");

    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: this.getAccessTokenHeaders(),
      body: form,
    });

    if (!res.ok) {
      let body = "";

      try {
        body = await res.text();
      } catch (err) {
        // Ignore
      }

      throw new Error(
        `Failed to get reddit access token from auth code. Status: ${res.status}. Body: ${body}`
      );
    }

    return (await res.json()) as RedditAccessToken;
  }

  async refreshAccessToken(refreshToken: string): Promise<RedditAccessToken> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Reddit client id or secret not found");
    }

    const data: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    const form = Object.entries(data)
      .map(([key, value]) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(value);
      })
      .join("&");

    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: this.getAccessTokenHeaders(),
      body: form,
    });

    if (!res.ok) {
      if (res.status === 400) {
        throw new RedditAppRevokedException(
          "Reddit application has been revoked by user"
        );
      }

      let body = "";

      try {
        body = await res.text();
      } catch (err) {
        // Ignore
      }

      throw new Error(
        `Failed to refresh reddit access token. Status: ${res.status}. Body: ${body}`
      );
    }

    return (await res.json()) as RedditAccessToken;
  }

  async revokeRefreshToken(refreshToken: string) {
    const res = await fetch("https://www.reddit.com/api/v1/revoke_token", {
      method: "POST",
      headers: this.getAccessTokenHeaders(),
      body: `token=${refreshToken}&token_type_hint=refresh_token`,
    });

    if (!res.ok) {
      let body = "";

      try {
        body = await res.text();
      } catch (err) {
        // Ignore
      }

      throw new Error(
        `Failed to revoke reddit refresh token. Status: ${res.status}. Body: ${body}`
      );
    }
  }

  private getAccessTokenHeaders() {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(this.clientId + ":" + this.clientSecret).toString("base64"),
    };
  }
}
