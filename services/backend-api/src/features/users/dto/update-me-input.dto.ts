import { Type } from "class-transformer";
import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from "class-validator";

class UpdateMeDtoPreferencesDto {
  @IsBoolean()
  @IsOptional()
  alertOnDisabledFeeds?: boolean;
}

export class UpdateMeDto {
  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateMeDtoPreferencesDto)
  preferences?: UpdateMeDtoPreferencesDto;
}
