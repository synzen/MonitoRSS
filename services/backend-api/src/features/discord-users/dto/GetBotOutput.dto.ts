import { DiscordBotUser } from "../types/discord-bot-user.type";

export class GetBotOutputDto {
  result: {
    username: string;
    id: string;
    avatar: string | null;
  };

  static fromEntity(user: DiscordBotUser): GetBotOutputDto {
    return {
      result: {
        username: user.username,
        id: user.id,
        avatar: user.avatar,
      },
    };
  }
}
