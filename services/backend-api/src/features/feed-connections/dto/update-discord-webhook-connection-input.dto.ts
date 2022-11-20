import { Type } from "class-transformer";
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { DiscordEmbed } from "../../../common";

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
}
