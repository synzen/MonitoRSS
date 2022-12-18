import { JobResponse } from "@synzen/discord-rest";
import {
  JobData,
  JobResponseError,
} from "@synzen/discord-rest/dist/RESTConsumer";

export interface ArticleDeliveryResult {
  job: JobData;
  result: JobResponse<never> | JobResponseError;
}
