import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
} from "class-validator";

export class GetUserFeedArticlesInputDto {
  @IsInt()
  @IsPositive()
  @IsIn([1]) // Until more than 1 is supported in the UI
  @Type(() => Number)
  limit: number;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  random?: boolean;
}
