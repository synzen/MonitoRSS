import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  DiscordEmbed,
  DiscordConnectionFormatterOptions,
  DiscordSplitOptions,
} from "../../../common";
import { FeedConnectionDisabledCode } from "../../feeds/constants";

class FiltersDto {
  @IsObject()
  expression: Record<string, unknown>;
}

export class UpdateDiscordChannelConnectionInputDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  forumThreadTitle?: string;

  @IsObject()
  @IsOptional()
  @Type(() => FiltersDto)
  @ValidateNested({ each: true })
  filters?: FiltersDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  @IsOptional()
  embeds?: DiscordEmbed[];

  @IsIn([FeedConnectionDisabledCode.Manual, null])
  @IsOptional()
  disabledCode?: FeedConnectionDisabledCode.Manual | null;

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
  formatter?: DiscordConnectionFormatterOptions | null;
}
