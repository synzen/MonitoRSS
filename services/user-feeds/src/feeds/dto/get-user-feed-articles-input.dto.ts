import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from "class-validator";

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
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  includeFilterResults?: boolean;
}
