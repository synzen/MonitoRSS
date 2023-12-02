import { IsOptional, IsString, Validate, ValidateIf } from "class-validator";
import { IsValidDateLocale } from "../validations/is-valid-date-locale";
import { IsValidTimezone } from "../validations/is-valid-timezone";

export class UserFeedFormatOptions {
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @IsString()
  @IsOptional()
  @Validate(IsValidTimezone)
  @ValidateIf((o) => !!o.dateTimezone)
  dateTimezone?: string;

  @IsString()
  @IsOptional()
  @Validate(IsValidDateLocale)
  @ValidateIf((o) => !!o.dateLocale)
  dateLocale?: string;
}
