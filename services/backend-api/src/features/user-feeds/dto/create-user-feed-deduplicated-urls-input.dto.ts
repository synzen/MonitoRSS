import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class CreateUserFeedDeduplicatedUrlsInputDto {
  @IsString({ each: true })
  @IsArray()
  @IsNotEmpty({ each: true })
  url: string[];
}
