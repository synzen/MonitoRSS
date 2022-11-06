/* eslint-disable max-len */
import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";
import { CreateDiscordChannelConnectionOutputDto } from "../../feed-connections/dto/create-discord-channel-connection-output.dto";
import { CreateDiscordWebhookConnectionOutputDto } from "../../feed-connections/dto/create-discord-webhook-connection-output.dto";
import { FeedConnectionType } from "../../feeds/constants";

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
}

export class GetUserFeedOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedOutputResultDto)
  result: GetUserFeedOutputResultDto;
}
