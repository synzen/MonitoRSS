import { Type } from "class-transformer";
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IsValidDateLocale } from "../../../common/validations/is-valid-date-locale";
import { IsValidTimezone } from "../../../common/validations/is-valid-timezone";

class UpdateMeDtoPreferencesDto {
  @IsBoolean()
  @IsOptional()
  alertOnDisabledFeeds?: boolean;

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

export class UpdateMeDto {
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateMeDtoPreferencesDto)
  preferences?: UpdateMeDtoPreferencesDto;
}
