import { IsInt, IsPositive } from "class-validator";

export class CustomRateLimitDto {
  @IsInt()
  @IsPositive()
  timeWindowSeconds: number;

  @IsInt()
  @IsPositive()
  limit: number;
}
