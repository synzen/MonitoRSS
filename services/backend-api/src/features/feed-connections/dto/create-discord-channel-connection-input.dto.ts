import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

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
}
