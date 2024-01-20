import { Type } from "class-transformer";
import {
  IsArray,
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
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { GetUserFeedArticlesFilterReturnType } from "../constants";
import { GetUserFeedArticlesFormatterDto } from "./shared";
import { CustomPlaceholder } from "../../article-formatter/types/format-options";
export class CustomPlaceholderStepDto {
  @IsString()
  @IsNotEmpty()
  regexSearch: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.replacementString !== null)
  replacementString?: string | null;
}

class FormatterDto {
  @IsObject()
  @Type(() => GetUserFeedArticlesFormatterDto)
  @ValidateNested()
  options: GetUserFeedArticlesFormatterDto;

  @IsObject({ each: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholder)
  @ValidateIf((v) => v.customPlaceholders !== null)
  customPlaceholders?: CustomPlaceholder[] | null;
}

class FiltersDto {
  @IsEnum(GetUserFeedArticlesFilterReturnType)
  returnType: GetUserFeedArticlesFilterReturnType;

  @IsObject()
  @IsOptional()
  expression?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  articleId?: string;

  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  articleIdHashes?: string[];

  @IsString()
  @IsOptional()
  search?: string;
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

  @IsObject()
  @Type(() => FormatterDto)
  @ValidateNested()
  formatter: FormatterDto;
}
