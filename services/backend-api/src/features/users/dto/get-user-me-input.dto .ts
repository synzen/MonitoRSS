import { Transform, Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class GetUserMeInputDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => (value != null ? Boolean(value) : value))
  includeManageSubUrls?: boolean;
}
