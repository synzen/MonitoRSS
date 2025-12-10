import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IsValidDateLocale } from "../../../common/validations/is-valid-date-locale";
import { IsValidTimezone } from "../../../common/validations/is-valid-timezone";

class FeedListSortDto {
  @IsString()
  @IsIn(["title", "url", "createdAt", "ownedByUser", "computedStatus"])
  key: string;

  @IsString()
  @IsIn(["asc", "desc"])
  direction: "asc" | "desc";
}

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

  @IsOptional()
  @ValidateNested()
  @ValidateIf((o) => o.feedListSort !== null)
  @Type(() => FeedListSortDto)
  feedListSort?: FeedListSortDto | null;
}

export class UpdateMeDto {
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateMeDtoPreferencesDto)
  preferences?: UpdateMeDtoPreferencesDto;
}
