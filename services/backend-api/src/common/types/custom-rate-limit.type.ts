import { Type } from "class-transformer";
import { IsInt, IsPositive, Max } from "class-validator";

export class CustomRateLimitDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  // 1 month
  @Max(2592000)
  timeWindowSeconds: number;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  @Max(10000)
  limit: number;
}
