import { IsNotEmpty, IsString } from "class-validator";

export class CreateUserFeedUrlValidationInputDto {
  @IsNotEmpty()
  @IsString()
  url: string;
}
