import { IsString, MaxLength } from "class-validator";

export class CreateDiscordChnnnelConnectionInputDto {
  @IsString()
  @MaxLength(250)
  name: string;

  @IsString()
  channelId: string;
}
