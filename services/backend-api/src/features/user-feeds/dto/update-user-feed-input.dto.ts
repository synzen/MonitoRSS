import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import {
  UserFeedDateCheckOptions,
  UserFeedFormatOptions,
  UserFeedShareManageOptions,
  ExternalPropertyDto,
} from "../../../common";
import { UserFeedDisabledCode } from "../types";

@ValidatorConstraint({ name: "uniqueExternalPropertyLabels", async: false })
export class ExternalPropertyUniqueLabels
  implements ValidatorConstraintInterface
{
  validate(externalProperties?: ExternalPropertyDto[]) {
    if (!externalProperties) {
      return true;
    }

    const labels = externalProperties.map((p) => p.label);

    return new Set(labels).size === labels.length;
  }

  defaultMessage() {
    return "External properties must have unique labels";
  }
}

export class UpdateUserFeedInputDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
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
  @Type(() => UserFeedFormatOptions)
  @ValidateNested()
  @IsObject()
  formatOptions?: UserFeedFormatOptions;

  @IsOptional()
  @Type(() => UserFeedDateCheckOptions)
  @ValidateNested()
  @IsObject()
  dateCheckOptions?: UserFeedDateCheckOptions;

  @IsOptional()
  @IsObject()
  @Type(() => UserFeedShareManageOptions)
  @ValidateNested()
  shareManageOptions?: UserFeedShareManageOptions;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  @IsInt()
  @ValidateIf(
    (o) =>
      o.userRefreshRateSeconds !== null &&
      o.userRefreshRateSeconds !== undefined
  )
  userRefreshRateSeconds?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalPropertyDto)
  @Validate(ExternalPropertyUniqueLabels)
  externalProperties?: ExternalPropertyDto[];
}
