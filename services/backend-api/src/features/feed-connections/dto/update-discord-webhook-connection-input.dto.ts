import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  CustomPlaceholderDto,
  CustomRateLimitDto,
  DiscordEmbed,
  DiscordPlaceholderLimitOptions,
  MentionsOptionsDto,
} from "../../../common";
import { FeedConnectionDisabledCode } from "../../feeds/constants";

class Webhook {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;
}

class FiltersDto {
  @IsObject()
  expression: Record<string, unknown>;
}

class SplitOptions {
  @IsBoolean()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  isEnabled?: boolean | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  appendChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  prependChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  splitChar?: string | null;
}

class FormatterDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  formatTables?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stripImages: boolean;
}

export class UpdateDiscordWebhookConnectionInputDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => Webhook)
  webhook?: Webhook;

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

  @IsObject()
  @IsOptional()
  @Type(() => MentionsOptionsDto)
  @ValidateNested({ each: true })
  mentions?: MentionsOptionsDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordPlaceholderLimitOptions)
  placeholderLimits?: DiscordPlaceholderLimitOptions[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  @IsOptional()
  embeds?: DiscordEmbed[];

  @IsIn([FeedConnectionDisabledCode.Manual, null])
  @IsOptional()
  disabledCode?: FeedConnectionDisabledCode.Manual | null;

  @IsOptional()
  @Type(() => SplitOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  splitOptions?: SplitOptions | null;

  @IsOptional()
  @Type(() => FormatterDto)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  formatter?: FormatterDto | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enablePlaceholderFallback?: boolean;

  @IsObject({ each: true })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderDto)
  customPlaceholders?: CustomPlaceholderDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CustomRateLimitDto)
  rateLimits?: CustomRateLimitDto[];
}
