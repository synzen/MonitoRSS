import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from "class-validator";
import {
  UserFeedDateCheckOptions,
  UserFeedFormatOptions,
} from "../../../common";
import { UserFeedDisabledCode } from "../types";

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
  @Type(() => UserFeedFormatOptions)
  @ValidateNested()
  @IsObject()
  formatOptions?: UserFeedFormatOptions;

  @IsOptional()
  @Type(() => UserFeedDateCheckOptions)
  @ValidateNested()
  @IsObject()
  dateCheckOptions?: UserFeedDateCheckOptions;
}
