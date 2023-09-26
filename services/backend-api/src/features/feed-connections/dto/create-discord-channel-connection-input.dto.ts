import { Type } from "class-transformer";
import {
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
}
