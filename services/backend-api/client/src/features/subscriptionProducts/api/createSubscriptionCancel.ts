import fetchRest from "../../../utils/fetchRest";

export const createSubscriptionCancel = async (): Promise<void> => {
  await fetchRest(`/api/v1/subscription-products/cancel`);
};
