import fetchRest from "../../../utils/fetchRest";

export interface CreateSubscriptionChangeInput {
  data: {
    prices: Array<{
      priceId: string;
      quantity: number;
    }>;
  };
}

export const createSubscriptionChange = async ({
  data,
}: CreateSubscriptionChangeInput): Promise<void> => {
  await fetchRest(`/api/v1/subscription-products/update`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(data),
    },
  });
};
