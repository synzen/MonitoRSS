import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export enum GetArticlesResponseRequestStatus {
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
  TimedOut = "TIMED_OUT",
}

class FilterStatus {
  @IsBoolean()
  passed: boolean;
}

class Response {
  @IsOptional()
  @IsInt()
  statusCode?: number;
}

class ExternalContentError {
  @IsString()
  articleId: string;

  @IsString()
  sourceField: string;

  @IsString()
  label: string;

  @IsString()
  cssSelector: string;

  @IsString()
  errorType: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsInt()
  @IsOptional()
  statusCode?: number;

  @IsString()
  @IsOptional()
  pageHtml?: string;

  @IsBoolean()
  @IsOptional()
  pageHtmlTruncated?: boolean;
}

class Result {
  @IsIn(Object.values(GetArticlesResponseRequestStatus))
  requestStatus: GetArticlesResponseRequestStatus;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  response?: Response;

  @IsArray()
  @IsObject({ each: true })
  articles: Array<Record<string, string>>;

  @IsInt()
  @Min(0)
  totalArticles: number;

  @IsObject({ each: true })
  @IsArray()
  @Type(() => FilterStatus)
  @ValidateNested({ each: true })
  @IsOptional()
  filterStatuses?: Array<FilterStatus>;

  @IsString({ each: true })
  @IsArray()
  selectedProperties: string[];

  @IsString()
  @IsOptional()
  url?: string;

  @IsBoolean()
  @IsOptional()
  attemptedToResolveFromHtml?: boolean;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  feedTitle?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalContentError)
  @IsOptional()
  externalContentErrors?: ExternalContentError[];
}

export class GetArticlesResponse {
  @ValidateNested()
  @IsObject()
  result: Result;
}
