import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";

class CreateSubscriptionPreviewPriceInputDto {
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateSubscriptionPreviewInputDto {
  @IsString()
  @IsOptional()
  priceId?: string;

  @IsArray()
  @IsOptional()
  @Type(() => CreateSubscriptionPreviewPriceInputDto)
  prices?: CreateSubscriptionPreviewPriceInputDto[];
}
