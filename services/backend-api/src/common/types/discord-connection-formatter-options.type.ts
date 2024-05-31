import { Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class DiscordConnectionFormatterOptions {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  formatTables?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stripImages?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  disableImageLinkPreviews?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  ignoreNewLines?: boolean;
}
