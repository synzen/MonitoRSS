import { IsOptional, IsString } from "class-validator";

export class CreateUserFeedDatePreviewInput {
  @IsString()
  @IsOptional()
  dateFormat?: string;

  @IsString()
  @IsOptional()
  dateTimezone?: string;

  @IsString()
  @IsOptional()
  dateLocale?: string;
}
