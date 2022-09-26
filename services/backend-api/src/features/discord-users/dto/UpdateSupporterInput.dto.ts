import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

export class UpdateSupporterInputDto {
  @IsString({ each: true })
  @IsOptional()
  // Don't save empty strings
  @Transform(({ value }) => value.filter((val: string) => val))
  guildIds: string[];
}
