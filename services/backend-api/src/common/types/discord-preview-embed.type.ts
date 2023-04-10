import { Type } from "class-transformer";
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class DiscordEmbedFooter {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  text?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  iconUrl?: string | null;
}

class DiscordEmbedAuthor {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  name?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  url?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  iconUrl?: string | null;
}

class DiscordEmbedThumbnail {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  url?: string | null;
}

class DiscordEmbedImage {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  url?: string | null;
}

class DiscordEmbedField {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  name?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  value?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  inline?: boolean | null;
}

export class DiscordPreviewEmbed {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  title?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  description?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  url?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  color?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedFooter)
  @ValidateIf((v) => v !== null)
  footer?: DiscordEmbedFooter | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @ValidateIf((v) => v !== null)
  @Type(() => DiscordEmbedAuthor)
  author?: DiscordEmbedAuthor | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @ValidateIf((v) => v !== null)
  @Type(() => DiscordEmbedThumbnail)
  thumbnail?: DiscordEmbedThumbnail | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DiscordEmbedImage)
  @ValidateIf((v) => v !== null)
  image?: DiscordEmbedImage | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbedField)
  @ValidateIf((v) => v !== null)
  fields?: DiscordEmbedField[] | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  timestamp?: string | null;
}
