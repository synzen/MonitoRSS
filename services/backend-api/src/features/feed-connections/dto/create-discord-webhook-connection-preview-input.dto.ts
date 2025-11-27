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
  CustomPlaceholderDto,
  DiscordConnectionFormatterOptions,
  DiscordPlaceholderLimitOptions,
  DiscordSplitOptions,
  MentionsOptionsDto,
  UserFeedFormatOptions,
} from "../../../common";
import { DiscordPreviewEmbed } from "../../../common/types/discord-preview-embed.type";

class Article {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateDiscordWebhookConnectionPreviewInputDto {
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
  @Type(() => DiscordSplitOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  splitOptions?: DiscordSplitOptions | null;

  @IsOptional()
  @Type(() => MentionsOptionsDto)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  mentions?: MentionsOptionsDto | null;

  @IsObject({ each: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderDto)
  customPlaceholders?: CustomPlaceholderDto[] | undefined | null;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordPlaceholderLimitOptions)
  placeholderLimits?: DiscordPlaceholderLimitOptions[];

  @IsOptional()
  @Type(() => DiscordConnectionFormatterOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  connectionFormatOptions?: DiscordConnectionFormatterOptions | null;

  @IsOptional()
  @Type(() => UserFeedFormatOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  userFeedFormatOptions?: UserFeedFormatOptions | null;

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
