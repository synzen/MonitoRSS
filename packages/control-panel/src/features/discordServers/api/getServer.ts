import { z } from 'zod';
import { DiscordServerSchema } from '../types/DiscordServer';
import fetchRest from '../../../utils/fetchRest';

export interface GetServersInput {
  limit?: number;
  offset?: number;
}

const GetServersOutputSchema = z.object({
  results: z.array(DiscordServerSchema),
  total: z.number(),
});

export type GetServersOutput = z.infer<typeof GetServersOutputSchema>;

export const getServers = async (options?: GetServersInput): Promise<GetServersOutput> => {
  const searchParams = new URLSearchParams({
    limit: options?.limit?.toString() || '10',
    offset: options?.offset?.toString() || '0',
  });

  return fetchRest(`/api/v1/servers?${searchParams}`, {
    validateSchema: GetServersOutputSchema,
  });
};
