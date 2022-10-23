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
import { DiscordChannelConnectionDetails } from "../../feeds/entities/feed-connections";

class FiltersDto {
  @IsObject()
  expression: Record<string, unknown>;
}

class DetailsChannelDto {
  @IsString()
  id: string;
}

class DetailsDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DetailsChannelDto)
  channel: DetailsChannelDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  embeds: DiscordEmbed[];
}

export class CreateDiscordChannelConnectionOutputDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsIn([FeedConnectionType.DiscordChannel])
  key: FeedConnectionType.DiscordChannel;

  @IsObject()
  @Type(() => FiltersDto)
  @ValidateNested()
  @IsOptional()
  filters?: FiltersDto;

  @IsObject()
  @Type(() => DetailsDto)
  @ValidateNested()
  details: DiscordChannelConnectionDetails;
}
