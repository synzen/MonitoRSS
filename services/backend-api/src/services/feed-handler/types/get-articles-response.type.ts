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
  ValidateNested,
} from "class-validator";

export enum GetArticlesResponseRequestStatus {
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
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
}

export class GetArticlesResponse {
  @ValidateNested()
  @IsObject()
  result: Result;
}
