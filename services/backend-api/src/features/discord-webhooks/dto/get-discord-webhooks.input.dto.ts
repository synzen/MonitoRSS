import { Type } from "class-transformer";
import { IsObject, IsString, ValidateNested } from "class-validator";

class GetDiscordWebhooksInputFiltersDto {
  @IsString()
  serverId: string;
}

export class GetDiscordWebhooksInputDto {
  @IsObject()
  @ValidateNested()
  @Type(() => GetDiscordWebhooksInputFiltersDto)
  filters: GetDiscordWebhooksInputFiltersDto;
}
