import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
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
  FiltersDto,
  MentionsOptionsDto,
  DiscordPlaceholderLimitOptions,
  CustomPlaceholderDto,
  CustomRateLimitDto,
  ForumThreadTagDto,
} from "../../../common";
import { DiscordComponentRow } from "../../../common/types/discord-component-row.type";
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

class ApplicationWebhook {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  threadId?: string;
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
  channelNewThreadTitle?: string;

  @IsBoolean()
  @IsOptional()
  channelNewThreadExcludesPreview?: boolean;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Webhook)
  webhook?: Webhook;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationWebhook)
  applicationWebhook?: ApplicationWebhook;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  forumThreadTitle?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ForumThreadTagDto)
  forumThreadTags?: ForumThreadTagDto[];

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

  @IsArray()
  @ArrayMaxSize(5)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordComponentRow)
  componentRows?: DiscordComponentRow[];

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

  @IsString()
  @IsOptional()
  @IsIn(["new-thread"])
  @ValidateIf((v) => v !== null)
  threadCreationMethod?: "new-thread" | null;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  @ValidateIf((v) => v !== null)
  componentsV2?: Array<Record<string, unknown>>;
}
