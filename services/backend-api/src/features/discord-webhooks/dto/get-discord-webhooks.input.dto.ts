import { IsString, ValidateNested } from "class-validator";

class GetDiscordWebhooksInputFiltersDto {
  @IsString()
  serverId: string;
}

export class GetDiscordWebhooksInputDto {
  @ValidateNested()
  filters: GetDiscordWebhooksInputFiltersDto;
}
