import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class CreateUserFeedTagInputDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  label: string;

  @IsString()
  @IsOptional()
  @Length(6, 7)
  @Matches(/^[0-9A-Fa-f]{6}$/, {
    message: "color must be a valid hexadecimal color code",
  })
  color?: string;
}
