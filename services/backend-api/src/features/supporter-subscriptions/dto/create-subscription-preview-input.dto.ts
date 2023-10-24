import { IsNotEmpty, IsString } from "class-validator";

export class CreateSubscriptionPreviewInputDto {
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsNotEmpty()
  priceId: string;
}
