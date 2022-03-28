import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { DiscordServerSettingsSchema } from '../types';

export interface UpdateServerSettingsInput {
  serverId: string;
  details: {
    dateFormat?: string
    timezone?: string
  }
}

const UpdateServerSettingsOutputSchema = object({
  result: object({
    profile: DiscordServerSettingsSchema.required(),
  }),
});

export type UpdateServerSettingsOutput = InferType<typeof UpdateServerSettingsOutputSchema>;

export const updateServerSettings = async (
  options: UpdateServerSettingsInput,
): Promise<UpdateServerSettingsOutput> => fetchRest(
  `/api/v1/discord-servers/${options.serverId}`,
  {
    validateSchema: UpdateServerSettingsOutputSchema,
    requestOptions: {
      method: 'PATCH',
      body: JSON.stringify(options.details),
    },
  },
);
