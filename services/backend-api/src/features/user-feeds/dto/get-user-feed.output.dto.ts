/* eslint-disable max-len */
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";
import { CreateDiscordChannelConnectionOutputDto } from "../../feed-connections/dto/create-discord-channel-connection-output.dto";
import { CreateDiscordWebhookConnectionOutputDto } from "../../feed-connections/dto/create-discord-webhook-connection-output.dto";

class GetUserFeedOutputResultConnectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDiscordChannelConnectionOutputDto)
  discordChannels: CreateDiscordChannelConnectionOutputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDiscordWebhookConnectionOutputDto)
  discordWebhooks: CreateDiscordWebhookConnectionOutputDto[];
}

class GetUserFeedOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedOutputResultConnectionsDto)
  connections: GetUserFeedOutputResultConnectionsDto;
}

export class GetUserFeedOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedOutputResultDto)
  result: GetUserFeedOutputResultDto;
}
