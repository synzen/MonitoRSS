import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDiscordChannelConnectionCloneInputDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  targetFeedIds?: string[];
}
