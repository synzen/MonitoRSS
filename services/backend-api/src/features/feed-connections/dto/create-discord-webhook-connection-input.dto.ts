import { Type } from "class-transformer";
import {
  IsObject,
  IsOptional,
  IsString,
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

export class CreateDiscordWebhookConnectionInputDto {
  @IsString()
  name: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Webhook)
  webhook: Webhook;
}
