import { Injectable, PipeTransform } from "@nestjs/common";
import { SessionAccessToken } from "../../discord-auth/types/SessionAccessToken.type";
import { User } from "../entities/user.entity";
import { UsersService } from "../users.service";

export interface GetUserFromAccessTokenOutput {
  accessToken: SessionAccessToken;
  user: User;
}

@Injectable()
export class GetUserFromAccessTokenPipe implements PipeTransform {
  constructor(private readonly usersService: UsersService) {}

  async transform(
    token: SessionAccessToken
  ): Promise<GetUserFromAccessTokenOutput> {
    const user = await this.usersService.getOrCreateUserByDiscordId(
      token.discord.id
    );

    return {
      accessToken: token,
      user,
    };
  }
}
