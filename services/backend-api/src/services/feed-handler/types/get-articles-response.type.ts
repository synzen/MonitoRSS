import { IsArray, IsIn, IsObject, ValidateNested } from "class-validator";

export enum GetArticlesResponseRequestStatus {
  Error = "error",
  ParseError = "parse_error",
  Pending = "pending",
  Success = "success",
}

class Result {
  @IsIn(Object.values(GetArticlesResponseRequestStatus))
  requestStatus: GetArticlesResponseRequestStatus;

  @IsArray()
  @IsObject({ each: true })
  articles: Array<Record<string, string>>;
}

export class GetArticlesResponse {
  @ValidateNested()
  @IsObject()
  result: Result;
}
