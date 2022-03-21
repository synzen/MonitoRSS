import fetchRest from '../../../utils/fetchRest';

export interface GetFeedArticlesRawDumpInput {
  feedId: string
}

export const getFeedArticlesRawDump = async (
  options: GetFeedArticlesRawDumpInput,
): Promise<Blob> => {
  const res: Response = await fetchRest(
    `/api/v1/feeds/${options.feedId}/articles/raw-dump`,
    {
      skipJsonParse: true,
    },
  );

  return res.blob();
};
