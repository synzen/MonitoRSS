import { Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class FormatOptions {
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  stripImages: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  formatTables: boolean;
}
