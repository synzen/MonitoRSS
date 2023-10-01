import { InferType, array, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetSubscriptionProductsInput {
  currency?: string;
}

const GetSubscriptionProductsOutputSchema = object({
  data: object({
    products: array(
      object({
        id: string().required(),
        prices: array(
          object({
            interval: string().oneOf(["month", "year"]).required(),
            formattedPrice: string().required(),
            currencyCode: string().required(),
          }).required()
        ).required(),
      }).required()
    ).required(),
    currencies: array(
      object({
        code: string().required(),
        symbol: string().required(),
      }).required()
    ).required(),
  }).required(),
});

export type GetSubscriptionProductsOutput = InferType<typeof GetSubscriptionProductsOutputSchema>;

export const getSubscriptionProducts = async ({
  currency,
}: GetSubscriptionProductsInput): Promise<GetSubscriptionProductsOutput> => {
  const searchParams = new URLSearchParams();

  searchParams.set("currency", currency || "USD");

  const res = await fetchRest(`/api/v1/subscription-products?${searchParams.toString()}`, {
    validateSchema: GetSubscriptionProductsOutputSchema,
  });

  return res as GetSubscriptionProductsOutput;
};
