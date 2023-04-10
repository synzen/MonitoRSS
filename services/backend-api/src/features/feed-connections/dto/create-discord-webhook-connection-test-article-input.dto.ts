import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class Article {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateDiscordWebhookConnectionTestArticleInputDto {
  @IsObject()
  @Type(() => Article)
  @IsOptional()
  @ValidateNested()
  article?: Article;
}
