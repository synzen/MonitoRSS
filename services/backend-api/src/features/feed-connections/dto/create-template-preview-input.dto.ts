import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  UserFeedFormatOptions,
  DiscordPlaceholderLimitOptions,
  DiscordConnectionFormatterOptions,
} from "../../../common";
import { DiscordPreviewEmbed } from "../../../common/types/discord-preview-embed.type";

class Article {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateTemplatePreviewInputDto {
  @IsObject()
  @Type(() => Article)
  @ValidateNested()
  article: Article;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordPreviewEmbed)
  embeds?: DiscordPreviewEmbed[];

  @IsOptional()
  @Type(() => DiscordPlaceholderLimitOptions)
  @ValidateNested({ each: true })
  @IsArray()
  placeholderLimits?: DiscordPlaceholderLimitOptions[];

  @IsOptional()
  @Type(() => UserFeedFormatOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  userFeedFormatOptions?: UserFeedFormatOptions | null;

  @IsOptional()
  @Type(() => DiscordConnectionFormatterOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  connectionFormatOptions?: DiscordConnectionFormatterOptions | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enablePlaceholderFallback?: boolean;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  @ValidateIf((v) => v !== null)
  componentsV2?: Array<Record<string, unknown>>;
}
