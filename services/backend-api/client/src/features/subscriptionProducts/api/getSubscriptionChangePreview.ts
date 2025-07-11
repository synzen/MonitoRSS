import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetSubscriptionChangePreviewInput {
  data: {
    priceId?: string;
    prices?: Array<{
      priceId: string;
      quantity: number;
    }>;
  };
}

const GetSubscriptionChangePreviewSchema = object({
  data: object({
    immediateTransaction: object({
      billingPeriod: object({
        startsAt: string().required(),
        endsAt: string().required(),
      }).required(),
      subtotalFormatted: string().required(),
      taxFormatted: string().required(),
      credit: string().required(),
      creditFormatted: string().required(),
      totalFormatted: string().required(),
      grandTotalFormatted: string().required(),
    }).required(),
  }).required(),
});

export type GetSubscriptionChangePreviewOutput = InferType<
  typeof GetSubscriptionChangePreviewSchema
>;

export const getSubscriptionChangePreview = async ({
  data,
}: GetSubscriptionChangePreviewInput): Promise<GetSubscriptionChangePreviewOutput> => {
  if (!data.priceId && !data.prices) {
    throw new Error("Missing priceId or prices while getting subscription change preview");
  }

  const res = await fetchRest(`/api/v1/subscription-products/update-preview`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(data),
    },
    validateSchema: GetSubscriptionChangePreviewSchema,
  });

  return res as GetSubscriptionChangePreviewOutput;
};
