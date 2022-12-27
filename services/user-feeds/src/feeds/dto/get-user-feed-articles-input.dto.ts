import { Type } from "class-transformer";
import {
  IsBoolean,
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
  @Type(() => Number)
  limit: number;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  random?: boolean;
}
