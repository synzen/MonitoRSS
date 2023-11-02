import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CustomPlaceholderDto } from "../../../common";
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
}

export class CreateUserFeedCloneInput {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  url?: string;
}
