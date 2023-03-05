import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

class SplitOptions {
  @IsNumber()
  @Min(100)
  maxCharacters: number;
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
