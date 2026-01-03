import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { IsValidDateLocale } from "../../../common/validations/is-valid-date-locale";
import { IsValidTimezone } from "../../../common/validations/is-valid-timezone";

class FeedListSortDto {
  @IsString()
  @IsIn([
    "title",
    "url",
    "createdAt",
    "ownedByUser",
    "computedStatus",
    "refreshRateSeconds",
  ])
  key: string;

  @IsString()
  @IsIn(["asc", "desc"])
  direction: "asc" | "desc";
}

@ValidatorConstraint({ name: "HasAtLeastOneVisibleColumn", async: false })
class HasAtLeastOneVisibleColumn implements ValidatorConstraintInterface {
  validate(value: FeedListColumnVisibilityDto) {
    if (!value || typeof value !== "object") {
      return true;
    }

    const values = Object.values(value);

    if (values.every((v) => v === undefined)) {
      return true;
    }

    return values.some((v) => v === true);
  }

  defaultMessage() {
    return "At least one column must be visible";
  }
}

class FeedListColumnVisibilityDto {
  @IsBoolean()
  @IsOptional()
  computedStatus?: boolean;

  @IsBoolean()
  @IsOptional()
  title?: boolean;

  @IsBoolean()
  @IsOptional()
  url?: boolean;

  @IsBoolean()
  @IsOptional()
  createdAt?: boolean;

  @IsBoolean()
  @IsOptional()
  ownedByUser?: boolean;

  @IsBoolean()
  @IsOptional()
  refreshRateSeconds?: boolean;
}

class FeedListColumnOrderDto {
  @IsArray()
  @IsString({ each: true })
  @IsIn(
    [
      "title",
      "computedStatus",
      "url",
      "createdAt",
      "refreshRateSeconds",
      "ownedByUser",
    ],
    { each: true }
  )
  columns: string[];
}

class FeedListStatusFiltersDto {
  @IsArray()
  @IsString({ each: true })
  @IsIn(["OK", "REQUIRES_ATTENTION", "MANUALLY_DISABLED", "RETRYING"], {
    each: true,
  })
  statuses: string[];
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

  @IsOptional()
  @ValidateNested()
  @Validate(HasAtLeastOneVisibleColumn)
  @Type(() => FeedListColumnVisibilityDto)
  feedListColumnVisibility?: FeedListColumnVisibilityDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedListColumnOrderDto)
  feedListColumnOrder?: FeedListColumnOrderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedListStatusFiltersDto)
  feedListStatusFilters?: FeedListStatusFiltersDto;
}

export class UpdateMeDto {
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateMeDtoPreferencesDto)
  preferences?: UpdateMeDtoPreferencesDto;
}
