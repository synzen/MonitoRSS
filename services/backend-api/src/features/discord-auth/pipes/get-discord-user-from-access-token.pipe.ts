import { Injectable, PipeTransform } from "@nestjs/common";
import { DiscordUser } from "../../discord-users/types/DiscordUser.type";
import { DiscordAuthService } from "../discord-auth.service";
import { SessionAccessToken } from "../types/SessionAccessToken.type";

export interface GetDiscordUserFromAccessTokenOutput {
  accessToken: SessionAccessToken;
  user: DiscordUser;
}

@Injectable()
export class GetDiscordUserFromAccessTokenPipe implements PipeTransform {
  constructor(private readonly discordAuthService: DiscordAuthService) {}

  async transform(
    token: SessionAccessToken
  ): Promise<GetDiscordUserFromAccessTokenOutput> {
    const discordUser = await this.discordAuthService.getUser(
      token.access_token
    );

    return {
      accessToken: token,
      user: discordUser,
    };
  }
}
