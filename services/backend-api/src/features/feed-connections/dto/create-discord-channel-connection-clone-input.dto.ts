import { IsNotEmpty, IsString } from "class-validator";

export class CreateDiscordChannelConnectionCloneInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
