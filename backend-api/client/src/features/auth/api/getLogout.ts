import fetchRest from '../../../utils/fetchRest';

export const getLogout = async (): Promise<any> => fetchRest('/api/v1/discord/logout', {
  skipJsonParse: true,
});
