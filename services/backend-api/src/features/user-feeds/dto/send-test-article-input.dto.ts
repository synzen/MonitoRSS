import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  DiscordPlaceholderLimitOptions,
  UserFeedFormatOptions,
} from "../../../common";
import { DiscordPreviewEmbed } from "../../../common/types/discord-preview-embed.type";

class Article {
  @IsString()
  @IsNotEmpty()
  id: string;
}

class WebhookDetails {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;
}

export class SendTestArticleInputDto {
  @IsObject()
  @Type(() => Article)
  @ValidateNested()
  article: Article;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordPreviewEmbed)
  embeds?: DiscordPreviewEmbed[];

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  @ValidateIf((v) => v !== null)
  componentsV2?: Array<Record<string, unknown>>;

  @IsOptional()
  @Type(() => DiscordPlaceholderLimitOptions)
  @ValidateNested({ each: true })
  @IsArray()
  placeholderLimits?: DiscordPlaceholderLimitOptions[];

  @IsOptional()
  @Type(() => WebhookDetails)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  webhook?: WebhookDetails | null;

  @IsString()
  @IsOptional()
  threadId?: string;

  @IsOptional()
  @Type(() => UserFeedFormatOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  userFeedFormatOptions?: UserFeedFormatOptions | null;
}
