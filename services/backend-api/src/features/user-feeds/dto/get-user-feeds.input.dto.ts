import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export enum GetUserFeedsInputSortKey {
  CreatedAtAscending = "createdAt",
  CreatedAtDescending = "-createdAt",
  TitleAscending = "title",
  TitleDescending = "-title",
  UrlAscending = "url",
  UrlDescending = "-url",
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
}
