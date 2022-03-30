import fetchRest from '../../../utils/fetchRest';

export interface GetServerBackupInput {
  serverId: string
}

export const getServerBackup = async (
  options: GetServerBackupInput,
): Promise<Blob> => {
  const res: Response = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/backup`,
    {
      skipJsonParse: true,
    },
  );

  return res.blob();
};
