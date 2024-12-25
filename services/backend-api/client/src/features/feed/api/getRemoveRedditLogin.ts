import fetchRest from "../../../utils/fetchRest";

export const getRemoveRedditLogin = async () => {
  await fetchRest(`/api/v1/reddit/remove`);
};
