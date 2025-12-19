import { IsNumber, IsOptional } from "class-validator";

export class DiagnoseArticlesInputDto {
  @IsNumber()
  @IsOptional()
  skip?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
