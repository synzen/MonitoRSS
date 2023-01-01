import { Request } from '../entities';

export interface GetFeedRequestsInput {
  limit: number;
  skip: number;
  url: string;
  select?: Array<keyof Request>;
}
