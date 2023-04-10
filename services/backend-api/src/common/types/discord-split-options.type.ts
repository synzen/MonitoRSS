import { IsBoolean, IsOptional, IsString, ValidateIf } from "class-validator";

export class DiscordSplitOptions {
  @IsBoolean()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  isEnabled?: boolean | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  appendChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  prependChar?: string | null;

  @IsString()
  @IsOptional()
  @ValidateIf((v) => v !== null)
  splitChar?: string | null;
}
