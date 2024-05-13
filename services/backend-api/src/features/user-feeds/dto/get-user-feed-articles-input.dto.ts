import { IsOptional, IsString } from "class-validator";

export class CreateUserFeedCloneInput {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  url?: string;
}
