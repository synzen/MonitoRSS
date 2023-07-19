import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class UserFeedDateCheckOptions {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  @IsInt()
  oldArticleDateDiffMsThreshold?: number;
}
