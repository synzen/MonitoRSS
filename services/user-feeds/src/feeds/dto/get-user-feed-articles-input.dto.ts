import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from "class-validator";
import { GetUserFeedArticlesFilterReturnType } from "../constants";

class FiltersDto {
  @IsEnum(GetUserFeedArticlesFilterReturnType)
  returnType: GetUserFeedArticlesFilterReturnType;

  @IsObject()
  @IsOptional()
  expression?: Record<string, unknown>;
}

export class GetUserFeedArticlesInputDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  limit: number;

  @IsInt()
  @Max(1000)
  @Min(0)
  @Type(() => Number)
  skip = 0;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  random?: boolean;

  /**
   * Properties of each article to send back in the response
   */
  @IsString({ each: true })
  @IsOptional()
  selectProperties?: string[];

  /**
   * Include the filter results for each article
   */
  @Type(() => FiltersDto)
  @IsObject()
  @IsOptional()
  filters?: FiltersDto;
}
