import { Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, ValidateNested } from "class-validator";
import { TestDeliveryStatus } from "../constants";
import { DiscordMessageApiPayload } from "./discord-message-api-payload.type";

export class CreatePreviewOutput {
  @IsIn(Object.values(TestDeliveryStatus))
  status: TestDeliveryStatus;

  @IsArray()
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordMessageApiPayload)
  messages?: DiscordMessageApiPayload[];

  @IsArray({ each: true })
  @IsOptional()
  customPlaceholderPreviews: string[][];
}
