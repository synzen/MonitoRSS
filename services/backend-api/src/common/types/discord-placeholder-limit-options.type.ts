import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from "class-validator";

export class DiscordPlaceholderLimitOptions {
  @IsString()
  @IsNotEmpty()
  placeholder: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  @Min(1)
  characterCount: number;

  @IsString()
  @IsOptional()
  appendString?: string;
}
