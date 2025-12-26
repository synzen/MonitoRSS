import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CustomPlaceholderDto } from "../../../common";
import { ExternalPropertyDto } from "../../../common/types/external-property.type";
import { GetFeedArticlesFilterReturnType } from "../types";

class FiltersDto {
  @IsEnum(GetFeedArticlesFilterReturnType)
  returnType: GetFeedArticlesFilterReturnType;

  @IsObject()
  @IsOptional()
  expression?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  articleId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  articleIdHashes?: string[];

  @IsString()
  @IsOptional()
  search?: string;
}

class FormatterOptionsDto {
  @IsBoolean()
  @Type(() => Boolean)
  formatTables = false;

  @IsBoolean()
  @Type(() => Boolean)
  stripImages = false;

  @IsBoolean()
  @Type(() => Boolean)
  disableImageLinkPreviews = false;

  @IsString()
  @ValidateIf((o) => !o.dateFormat)
  dateFormat?: string;

  @IsString()
  @ValidateIf((o) => !o.dateTimezone)
  dateTimezone?: string;
}

class FormatterDto {
  @Type(() => FormatterOptionsDto)
  @IsObject()
  @ValidateNested()
  options: FormatterOptionsDto;

  @IsObject({ each: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderDto)
  @ValidateIf((v) => v.customPlaceholders !== null)
  customPlaceholders?: CustomPlaceholderDto[] | null;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExternalPropertyDto)
  @ValidateIf((v) => v.externalProperties !== null)
  externalProperties?: ExternalPropertyDto[] | null;
}

export class GetUserFeedArticlesInputDto {
  @IsInt()
  @Max(50)
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit = 25;

  @IsInt()
  @Max(1000)
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  skip = 0;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  random?: boolean;

  /**
   * Properties of each article to send back in the response
   */
  @IsString({ each: true })
  @IsArray()
  @IsOptional()
  selectProperties?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  selectPropertyTypes?: string[];

  @Type(() => FiltersDto)
  @IsOptional()
  @IsObject()
  filters?: FiltersDto;

  @Type(() => FormatterDto)
  @IsObject()
  formatter: FormatterDto;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  includeHtmlInErrors?: boolean;
}
