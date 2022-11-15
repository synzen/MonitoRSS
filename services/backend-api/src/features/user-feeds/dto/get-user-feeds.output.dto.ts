import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from "class-validator";
import { UserFeedHealthStatus } from "../types";

class GetUserFeedsOutputResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsIn(Object.values(UserFeedHealthStatus))
  healthStatus: UserFeedHealthStatus;
}

export class GetUserFeedsOutputDto {
  @IsInt()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GetUserFeedsOutputResultDto)
  results: GetUserFeedsOutputResultDto[];
}
