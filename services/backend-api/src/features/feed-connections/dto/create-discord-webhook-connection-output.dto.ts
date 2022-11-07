import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { DiscordEmbed } from "../../../common";
import { FeedConnectionType } from "../../feeds/constants";

class FiltersDto {
  @IsObject()
  expression: Record<string, unknown>;
}

class DetailsWebhookDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  guildId: string;
}

class DetailsDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DetailsWebhookDto)
  webhook: DetailsWebhookDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  embeds: DiscordEmbed[];
}

export class CreateDiscordWebhookConnectionOutputDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsIn([FeedConnectionType.DiscordWebhook])
  key: FeedConnectionType.DiscordWebhook;

  @IsObject()
  @Type(() => FiltersDto)
  @ValidateNested()
  @IsOptional()
  filters?: FiltersDto;

  @IsObject()
  @Type(() => DetailsDto)
  @ValidateNested()
  details: DetailsDto;
}
