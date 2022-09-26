import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class GetServerFeedsInputDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  limit: number;

  @IsInt()
  @Min(0)
  @Transform(({ value }) => Number(value))
  offset: number;

  @IsString()
  @IsOptional()
  search?: string;
}
