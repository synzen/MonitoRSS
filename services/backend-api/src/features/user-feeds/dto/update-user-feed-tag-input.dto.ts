import { IsOptional, IsString, MinLength, MaxLength } from "class-validator";

export class UpdateUserFeedTagInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(7)
  color?: string;
}
