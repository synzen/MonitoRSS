import { IsArray, IsObject, IsString, ValidateNested } from "class-validator";

class ResultDto {
  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class CreateFilterValidationResponse {
  @IsObject()
  @ValidateNested()
  result: ResultDto;
}
