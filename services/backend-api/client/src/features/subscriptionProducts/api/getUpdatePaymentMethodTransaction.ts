import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

const GetUpdatePaymentMethodTransactionOutputSchema = object({
  data: object({
    paddleTransactionId: string().required(),
  }).required(),
});

export type GetUpdatePaymentMethodTransactionOutput = InferType<
  typeof GetUpdatePaymentMethodTransactionOutputSchema
>;

export const getUpdatePaymentMethodTransaction =
  async (): Promise<GetUpdatePaymentMethodTransactionOutput> => {
    const res = await fetchRest(`/api/v1/subscription-products/change-payment-method`, {
      validateSchema: GetUpdatePaymentMethodTransactionOutputSchema,
    });

    return res as GetUpdatePaymentMethodTransactionOutput;
  };
