import fetchRest from "../../../utils/fetchRest";

export const createSubscriptionResume = async (): Promise<void> => {
  await fetchRest(`/api/v1/subscription-products/resume`);
};
