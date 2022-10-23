import { IsString } from "class-validator";

export class CreateDiscordChnnnelConnectionInputDto {
  @IsString()
  name: string;

  @IsString()
  channelId: string;
}
