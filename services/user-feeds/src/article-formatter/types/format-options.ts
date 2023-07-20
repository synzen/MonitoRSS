import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class SplitOptions {
  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  splitChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  appendChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  prependChar?: string | null;

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
  disableImageLinkPreviews: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  formatTables: boolean;

  @IsObject()
  @IsOptional()
  @Type(() => SplitOptions)
  @ValidateNested()
  split?: SplitOptions;
}
