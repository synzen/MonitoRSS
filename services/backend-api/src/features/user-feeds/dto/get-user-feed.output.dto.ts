/* eslint-disable max-len */
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { UserFeedShareManageOptions } from "../../../common";
import { CreateDiscordChannelConnectionOutputDto } from "../../feed-connections/dto/create-discord-channel-connection-output.dto";
import { CreateDiscordWebhookConnectionOutputDto } from "../../feed-connections/dto/create-discord-webhook-connection-output.dto";
import { FeedConnectionType } from "../../feeds/constants";
import { UserFeed } from "../entities";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../types";

class ConnectionBaseDto {
  @IsIn(Object.values(FeedConnectionType))
  key: FeedConnectionType;
}

class GetUserFeedOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  allowLegacyReversion?: boolean;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  passingComparisons?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  blockingComparisons?: string[];

  externalProperties?: UserFeed["externalProperties"];

  formatOptions?: UserFeed["formatOptions"];

  dateCheckOptions?: UserFeed["dateCheckOptions"];

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

  @IsInt()
  refreshRateSeconds: number;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  updatedAt: string;

  isLegacyFeed?: boolean;

  shareManageOptions?: UserFeedShareManageOptions;

  sharedAccessDetails?: {
    inviteId: string;
  };

  userRefreshRateSeconds?: number;
}

export class GetUserFeedOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedOutputResultDto)
  result: GetUserFeedOutputResultDto;
}
