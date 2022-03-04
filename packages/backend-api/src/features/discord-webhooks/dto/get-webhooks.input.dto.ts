import { IsString, ValidateNested } from 'class-validator';

class GetWebhooksInputFiltersDto {
  @IsString()
  serverId: string;
}

export class GetWebhooksInputDto {
  @ValidateNested()
  filters: GetWebhooksInputFiltersDto;
}
