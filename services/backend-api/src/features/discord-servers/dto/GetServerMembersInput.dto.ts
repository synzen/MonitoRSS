import { Transform } from "class-transformer";
import { IsInt, IsString, Min, MinLength } from "class-validator";

export class GetServerMembersInputDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  limit: number;

  @IsString()
  @MinLength(1)
  search: string;
}
