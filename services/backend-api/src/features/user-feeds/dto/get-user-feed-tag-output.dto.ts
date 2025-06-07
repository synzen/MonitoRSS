import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GetUserFeedTagOutputDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsArray()
  @IsString({ each: true })
  feedIds: string[];
}
