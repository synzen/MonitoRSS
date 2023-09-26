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

class DetailsChannelDto {
  @IsString()
  id: string;

  @IsString()
  guildId: string;
}

class DetailsWebhookDto {
  id: string;

  guildId: string;
}

class FormatterDto {
  formatTables?: boolean | null;

  stripImages?: boolean | null;
}

class DetailsDto {
  @IsString()
  @IsOptional()
  content?: string;

  channel?: DetailsChannelDto;
  webhook?: DetailsWebhookDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  embeds: DiscordEmbed[];

  formatter?: FormatterDto | null;
}

class SplitOptions {
  appendChar?: string | null;

  prependChar?: string | null;

  splitChar?: string | null;
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
