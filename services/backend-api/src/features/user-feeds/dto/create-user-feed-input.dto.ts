import { IsNotEmpty, IsString } from "class-validator";

export class CreateUserFeedInputDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @IsString()
  url: string;
}
