import { DiscordBotUser } from "../types/discord-bot-user.type";

export class GetBotOutputDto {
  result: {
    username: string;
    id: string;
    avatar: string | null;
    inviteLink: string;
  };

  static fromEntity(user: DiscordBotUser, inviteLink: string): GetBotOutputDto {
    return {
      result: {
        username: user.username,
        id: user.id,
        avatar: user.avatar,
        inviteLink,
      },
    };
  }
}
