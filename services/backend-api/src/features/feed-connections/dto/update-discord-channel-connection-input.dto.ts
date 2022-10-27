import { Type } from "class-transformer";
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { DiscordEmbed } from "../../../common";

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
