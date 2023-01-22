import { Type } from "class-transformer";
import { IsBoolean } from "class-validator";

export class FormatOptions {
  @IsBoolean()
  @Type(() => Boolean)
  stripImages: boolean;

  @IsBoolean()
  @Type(() => Boolean)
  formatTables: boolean;
}
