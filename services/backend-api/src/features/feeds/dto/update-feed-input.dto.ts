import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class UpdateFeedInputFiltersDto {
  @IsString()
  category: string;

  @IsString()
  value: string;
}

class UpdateFeedWebhookInputDto {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsOptional()
  iconUrl: string;

  @IsString()
  @IsOptional()
  name: string;
}

export class UpdateFeedInputDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  text?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateFeedWebhookInputDto)
  webhook?: UpdateFeedWebhookInputDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateFeedInputFiltersDto)
  @IsOptional()
  filters?: UpdateFeedInputFiltersDto[];

  @IsOptional()
  @IsBoolean()
  checkTitles?: boolean;

  @IsOptional()
  @IsBoolean()
  checkDates?: boolean;

  @IsOptional()
  @IsBoolean()
  imgPreviews?: boolean;

  @IsOptional()
  @IsBoolean()
  imgLinksExistence?: boolean;

  @IsOptional()
  @IsBoolean()
  formatTables?: boolean;

  @IsOptional()
  @IsBoolean()
  splitMessage?: boolean;

  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(1000)
  pcomparisons?: string[];

  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(1000)
  ncomparisons?: string[];
}
