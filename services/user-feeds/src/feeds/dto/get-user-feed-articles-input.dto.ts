import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";

export class GetUserFeedArticlesInputDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsInt()
  @IsPositive()
  @IsIn([1]) // Until more than 1 is supported
  @Type(() => Number)
  limit: number;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  random?: boolean;
}
