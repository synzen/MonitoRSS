import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class CreateUserFeedInputDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}
