/* eslint-disable max-len */
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { CreateDiscordChannelConnectionOutputDto } from "../../feed-connections/dto/create-discord-channel-connection-output.dto";
import { CreateDiscordWebhookConnectionOutputDto } from "../../feed-connections/dto/create-discord-webhook-connection-output.dto";
import { FeedConnectionType } from "../../feeds/constants";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../types";

class ConnectionBaseDto {
  @IsIn(Object.values(FeedConnectionType))
  key: FeedConnectionType;
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
  @Type(() => ConnectionBaseDto, {
    discriminator: {
      property: "key",
      subTypes: [
        {
          value: CreateDiscordChannelConnectionOutputDto,
          name: FeedConnectionType.DiscordChannel,
        },
        {
          value: CreateDiscordWebhookConnectionOutputDto,
          name: FeedConnectionType.DiscordWebhook,
        },
      ],
    },
  })
  connections: Array<
    | CreateDiscordChannelConnectionOutputDto
    | CreateDiscordWebhookConnectionOutputDto
  >;

  @IsString()
  @IsIn(Object.values(UserFeedDisabledCode))
  @IsOptional()
  disabledCode?: UserFeedDisabledCode;

  @IsString()
  @IsIn(Object.values(UserFeedHealthStatus))
  healthStatus: UserFeedHealthStatus;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  updatedAt: string;
}

export class GetUserFeedOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedOutputResultDto)
  result: GetUserFeedOutputResultDto;
}
