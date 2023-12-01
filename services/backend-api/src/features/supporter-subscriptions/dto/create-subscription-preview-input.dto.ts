import { IsNotEmpty, IsString } from "class-validator";

export class CreateSubscriptionPreviewInputDto {
  @IsString()
  @IsNotEmpty()
  priceId: string;
}
