import { Type } from "class-transformer";
import { IsArray, IsObject, IsString, ValidateNested } from "class-validator";

export class ArticleInjectionFieldDto {
  @IsString()
  name: string;

  @IsString()
  cssSelector: string;
}

export class ArticleInjectionDto {
  @IsString()
  sourceField: string;

  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ArticleInjectionFieldDto)
  fields: ArticleInjectionFieldDto[];
}
