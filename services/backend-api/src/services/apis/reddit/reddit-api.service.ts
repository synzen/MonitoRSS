import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedditAppRevokedException } from "./errors/reddit-app-revoked.exception";

export interface RedditAccessToken {
  access_token: string;
  token_type: "bearer";
  refresh_token: string;
  expires_in: number;
  scope: string;
}

@Injectable()
export class RedditApiService {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>(
      "BACKEND_API_REDDIT_CLIENT_ID"
    );
    this.clientSecret = this.configService.get<string>(
      "BACKEND_API_REDDIT_CLIENT_SECRET"
    );
    this.redirectUri = this.configService.get<string>(
      "BACKEND_API_REDDIT_REDIRECT_URI"
    );
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

    const form = Object.keys(data)
      .map((key) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(data[key]);
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
      } catch (err) {}

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

    const form = Object.keys(data)
      .map((key) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(data[key]);
      })
      .join("&");

    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: this.getAccessTokenHeaders(),
      body: form,
    });

    if (!res.ok) {
      // Reddit returns a 400 for this case
      if (res.status === 400) {
        throw new RedditAppRevokedException(
          "Reddit application has been revoked by user"
        );
      }

      let body = "";

      try {
        body = await res.text();
      } catch (err) {}

      throw new Error(
        `Failed to refresh reddit access token. Status: ${res.status}. Body: ${body}`
      );
    }

    return (await res.json()) as RedditAccessToken;
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
