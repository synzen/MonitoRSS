import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Validate,
  ValidateNested,
} from "class-validator";
import { IsValidTimezone } from "../../../common/validations/is-valid-timezone";
import { UserFeedDisabledCode } from "../types";

class FormatOptions {
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @IsString()
  @IsOptional()
  @Validate(IsValidTimezone)
  dateTimezone?: string;
}

export class UpdateUserFeedInputDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsIn([UserFeedDisabledCode.Manual, null])
  @IsOptional()
  disabledCode?: UserFeedDisabledCode | null;

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  passingComparisons?: string[];

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  blockingComparisons?: string[];

  @IsOptional()
  @Type(() => FormatOptions)
  @ValidateNested()
  @IsObject()
  formatOptions?: FormatOptions;
}
