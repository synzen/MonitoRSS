import {
  array, InferType, number, object,
} from 'yup';
import { DiscordServerSchema } from '../types/DiscordServer';
import fetchRest from '../../../utils/fetchRest';

export interface GetServersInput {
  limit?: number;
  offset?: number;
}

const GetServersOutputSchema = object({
  results: array(DiscordServerSchema),
  total: number(),
});

export type GetServersOutput = InferType<typeof GetServersOutputSchema>;

export const getServers = async (options?: GetServersInput): Promise<GetServersOutput> => {
  const searchParams = new URLSearchParams({
    limit: options?.limit?.toString() || '10',
    offset: options?.offset?.toString() || '0',
  });

  return fetchRest(`/api/v1/servers?${searchParams}`, {
    validateSchema: GetServersOutputSchema,
  });
};
