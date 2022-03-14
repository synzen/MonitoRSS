import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateServerInputDto {
  @IsOptional()
  @IsNotEmpty()
  dateFormat?: string;

  @IsOptional()
  @IsNotEmpty()
  dateLanguage?: string;

  @IsOptional()
  @IsNotEmpty()
  timezone?: string;
}
