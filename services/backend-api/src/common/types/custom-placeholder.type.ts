import { IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";

export class CustomPlaceholderDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  sourcePlaceholder: string;

  @IsString()
  @IsNotEmpty()
  regexSearch: string;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v.replacementString !== null)
  replacementString?: string | null;
}
