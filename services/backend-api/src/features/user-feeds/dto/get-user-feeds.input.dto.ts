import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { FeedConnectionDisabledCode } from "../../feeds/constants";
import { UserFeedComputedStatus } from "../constants/user-feed-computed-status.type";
import { UserFeedDisabledCode } from "../types";

export enum GetUserFeedsInputSortKey {
  CreatedAtAscending = "createdAt",
  CreatedAtDescending = "-createdAt",
  TitleAscending = "title",
  TitleDescending = "-title",
  UrlAscending = "url",
  UrlDescending = "-url",
  ComputedStatusAcending = "computedStatus",
  ComputedStatusDescending = "-computedStatus",
  OwnedByUserAscending = "ownedByUser",
  OwnedByUserDescending = "-ownedByUser",
}

export class GetUserFeedsInputFiltersDto {
  @IsArray()
  @IsOptional()
  @IsIn([...Object.values(UserFeedDisabledCode), ""], { each: true })
  @Transform(({ value }) => (value ? value.split(",") : undefined))
  disabledCodes?: (UserFeedDisabledCode | "")[];

  @IsArray()
  @IsOptional()
  @IsIn([...Object.values(FeedConnectionDisabledCode), ""], { each: true })
  @Transform(({ value }) => (value ? value.split(",") : undefined))
  connectionDisabledCodes?: (FeedConnectionDisabledCode | "")[];

  @IsArray()
  @IsOptional()
  @IsIn([...Object.values(UserFeedComputedStatus), ""], { each: true })
  @Transform(({ value }) => (value ? value.split(",") : undefined))
  computedStatuses?: UserFeedComputedStatus[];

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => (value != null ? !!value : undefined))
  ownedByUser?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  userTagIds?: string[];
}

export class GetUserFeedsInputDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  limit: number;

  @IsInt()
  @Min(0)
  @Transform(({ value }) => Number(value))
  offset: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsEnum(GetUserFeedsInputSortKey)
  @ValidateIf((v) => {
    return !!v.sort;
  })
  sort = GetUserFeedsInputSortKey.CreatedAtDescending;

  @IsOptional()
  @IsObject()
  @Type(() => GetUserFeedsInputFiltersDto)
  @ValidateNested()
  filters?: GetUserFeedsInputFiltersDto;
}
