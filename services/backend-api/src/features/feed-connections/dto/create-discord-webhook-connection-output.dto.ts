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

class SplitOptions {
  @IsString()
  @IsOptional()
  appendChar?: string;

  @IsString()
  @IsOptional()
  prependChar?: string;

  @IsString()
  @IsOptional()
  splitChar?: string;
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
  filters?: FiltersDto | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  passingComparisons?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  blockingComparisons?: string[];

  @IsObject()
  @Type(() => DetailsDto)
  @ValidateNested()
  details: DetailsDto;

  @IsObject()
  @Type(() => SplitOptions)
  @ValidateNested()
  @IsOptional()
  splitOptions?: SplitOptions;
}
