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
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  UserFeedDateCheckOptions,
  UserFeedFormatOptions,
  UserFeedShareManageOptions,
} from "../../../common";
import { ExternalPropertyDto } from "../../../common/types/external-property.type";
import { UserFeedDisabledCode } from "../types";

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
  externalProperties?: ExternalPropertyDto[];
}
