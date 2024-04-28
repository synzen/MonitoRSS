import { IsNotEmpty, IsString } from "class-validator";

export class ExternalPropertyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  sourceField: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  cssSelector: string;
}
