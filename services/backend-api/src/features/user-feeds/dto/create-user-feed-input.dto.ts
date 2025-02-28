import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateUserFeedInputDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsString()
  url: string;
}
