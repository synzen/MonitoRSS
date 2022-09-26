import { IsNotEmpty, IsOptional, Validate } from "class-validator";
import { IsValidTimezone } from "../../../common/validations/is-valid-timezone";

export class UpdateServerInputDto {
  @IsOptional()
  @IsNotEmpty()
  dateFormat?: string;

  @IsOptional()
  @IsNotEmpty()
  dateLanguage?: string;

  @IsOptional()
  @IsNotEmpty()
  @Validate(IsValidTimezone)
  timezone?: string;
}
