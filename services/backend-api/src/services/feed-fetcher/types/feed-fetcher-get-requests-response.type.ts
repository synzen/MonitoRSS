import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { FeedFetcherRequestStatus } from "./feed-fetcher-request-status.type";

class Response {
  @IsNumber()
  @IsOptional()
  statusCode?: number;
}

class Request {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  createdAt: number;

  @IsNumber()
  @Type(() => Number)
  id: number;

  @IsIn(Object.values(FeedFetcherRequestStatus))
  status: FeedFetcherRequestStatus;

  @Type(() => Response)
  @ValidateNested()
  @IsObject()
  response: Response;
}

class Result {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Request)
  requests: Request[];

  @ValidateIf((_, val) => val !== null)
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  nextRetryTimestamp: number | null;
}

export class FeedFetcherGetRequestsResponse {
  @ValidateNested()
  @Type(() => Result)
  @IsObject()
  result: Result;
}
