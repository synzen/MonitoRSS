import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class DiscordEmbedFooter {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  icon_url?: string;
}

class DiscordEmbedAuthor {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  icon_url?: string;
}

class DiscordEmbedThumbnail {
  @IsString()
  url: string;
}

class DiscordEmbedImage {
  @IsString()
  url: string;
}

class DiscordEmbedField {
  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  inline?: boolean;
}

export class DiscordEmbed {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedFooter)
  footer?: DiscordEmbedFooter;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedAuthor)
  author?: DiscordEmbedAuthor;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedThumbnail)
  thumbnail?: DiscordEmbedThumbnail;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedImage)
  image?: DiscordEmbedImage;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbedField)
  fields?: DiscordEmbedField[];

  @IsString()
  @IsOptional()
  @IsIn(["now", "article"])
  timestamp?: string;
}
