import { IsNotEmpty, IsString } from "class-validator";

export class CreateDiscordWebhookConnectionCloneInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
