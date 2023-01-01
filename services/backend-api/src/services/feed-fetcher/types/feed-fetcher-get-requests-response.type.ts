import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsPositive,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { FeedFetcherRequestStatus } from "./feed-fetcher-request-status.type";

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
}

class Result {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Request)
  requests: Request[];

  @Type(() => Number)
  @IsInt()
  totalRequests: number;

  @ValidateIf((_, val) => val !== null)
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  nextRetryDate: number | null;
}

export class FeedFetcherGetRequestsResponse {
  @ValidateNested()
  @Type(() => Result)
  @IsObject()
  result: Result;
}
