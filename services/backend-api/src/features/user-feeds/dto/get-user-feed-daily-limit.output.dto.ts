import { Type } from "class-transformer";
import { IsNumber, IsObject, ValidateNested } from "class-validator";

class GetUserFeedDailyLimitResult {
  @IsNumber()
  max: number;

  @IsNumber()
  current: number;
}

export class GetUserFeedDailyLimitOutputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetUserFeedDailyLimitResult)
  result: GetUserFeedDailyLimitResult;
}
