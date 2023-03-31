import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from "class-validator";

class SplitOptions {
  @IsString()
  @IsOptional()
  splitChar?: string;

  @IsString()
  @IsOptional()
  appendChar?: string;

  @IsString()
  @IsOptional()
  prependChar?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isEnabled?: boolean;
}

export class FormatOptions {
  @IsBoolean()
  @Type(() => Boolean)
  stripImages: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  formatTables: boolean;

  @IsObject()
  @IsOptional()
  @Type(() => SplitOptions)
  @ValidateNested()
  split?: SplitOptions;
}
