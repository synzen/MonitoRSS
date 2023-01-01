import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsIn,
  IsNumber,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { FeedFetcherRequestStatus } from "./feed-fetcher-request-status.type";

class Request {
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

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

  @ValidateIf((_, val) => val !== null)
  @IsDate()
  @Type(() => Date)
  nextRetryDate: Date | null;
}

export class FeedFetcherGetRequestsResponse {
  @ValidateNested()
  @Type(() => Result)
  @IsObject()
  result: Result;
}
