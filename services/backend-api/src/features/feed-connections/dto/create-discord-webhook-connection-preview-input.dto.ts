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
  DiscordConnectionFormatterOptions,
  DiscordSplitOptions,
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
  @IsOptional()
  @ValidateNested()
  article?: Article;

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
}
