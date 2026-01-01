import { Type } from "class-transformer";
import {
  IsArray,
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
  DiscordConnectionFormatterOptions,
  DiscordEmbed,
  DiscordPlaceholderLimitOptions,
} from "../../../common";

class Webhook {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  threadId?: string;
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

export class CreateDiscordChnnnelConnectionInputDto {
  @IsString()
  @MaxLength(250)
  name: string;

  @IsString()
  @IsOptional()
  channelId?: string;

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
  @IsIn(["new-thread"])
  threadCreationMethod?: "new-thread";

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordEmbed)
  @IsOptional()
  embeds?: DiscordEmbed[];

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  @ValidateIf((v) => v !== null)
  componentsV2?: Array<Record<string, unknown>>;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DiscordPlaceholderLimitOptions)
  placeholderLimits?: DiscordPlaceholderLimitOptions[];

  @IsOptional()
  @Type(() => DiscordConnectionFormatterOptions)
  @ValidateNested()
  @IsObject()
  @ValidateIf((v) => v !== null)
  formatter?: DiscordConnectionFormatterOptions | null;
}
