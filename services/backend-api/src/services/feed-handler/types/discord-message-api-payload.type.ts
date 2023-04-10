import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class DiscordEmbedFooter {
  @IsString()
  text: string;
  icon_url?: string | null;
}

class DiscordEmbedImage {
  @IsString()
  @ValidateIf((v) => v !== null)
  url: string | null;
}

class DiscordEmbedThumbnail {
  @IsString()
  @ValidateIf((v) => v !== null)
  url: string | null;
}

class DiscordEmbedAuthor {
  @IsString()
  name: string;

  @IsString()
  @ValidateIf((v) => v !== null)
  @IsOptional()
  url?: string | null;

  @IsString()
  @ValidateIf((v) => v !== null)
  @IsOptional()
  icon_url?: string | null;
}

class DiscordEmbedField {
  @IsString()
  name: string;

  @IsString()
  value: string;

  @IsBoolean()
  @IsOptional()
  inline?: boolean;
}

export class DiscordMessageApiPayload {
  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  @Type(() => DiscordEmbed)
  @ValidateNested()
  embeds?: DiscordEmbed[];
}

class DiscordEmbed {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  url?: string | null;

  @IsNumber()
  @IsOptional()
  color?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordEmbedFooter)
  @IsObject()
  footer?: DiscordEmbedFooter;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordEmbedImage)
  @IsObject()
  image?: DiscordEmbedImage;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordEmbedThumbnail)
  @IsObject()
  thumbnail?: DiscordEmbedThumbnail;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordEmbedAuthor)
  @IsObject()
  author?: DiscordEmbedAuthor;

  @IsOptional()
  @IsArray()
  @Type(() => DiscordEmbedField)
  @ValidateNested()
  fields?: DiscordEmbedField[];

  @IsString()
  @IsOptional()
  timestamp?: string;
}
