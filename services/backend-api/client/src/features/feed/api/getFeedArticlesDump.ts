import fetchRest from "../../../utils/fetchRest";

export interface GetFeedArticlesDumpInput {
  feedId: string;
}

export const getFeedArticlesDump = async (options: GetFeedArticlesDumpInput): Promise<Blob> => {
  const res: Response = await fetchRest(`/api/v1/feeds/${options.feedId}/articles/dump`, {
    skipJsonParse: true,
  });

  return res.blob();
};
