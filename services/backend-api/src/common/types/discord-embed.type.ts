import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class DiscordEmbedFooter {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;
}

class DiscordEmbedAuthor {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;
}

class DiscordEmbedThumbnail {
  @IsString()
  @IsNotEmpty()
  url: string;
}

class DiscordEmbedImage {
  @IsString()
  @IsNotEmpty()
  url: string;
}

class DiscordEmbedField {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
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
  @IsIn(["now", "article", ""])
  timestamp?: string;
}
