import { InferType, object, string } from "yup";
import fetchRest from "@/utils/fetchRest";

export interface WorkspaceBillingPricesInput {
  workspaceSlug: string;
  prices: Array<{ priceId: string; quantity: number }>;
}

const WorkspaceBillingChangePreviewOutputSchema = object({
  data: object({
    immediateTransaction: object({
      billingPeriod: object({
        startsAt: string().required(),
        endsAt: string().required(),
      }).required(),
      subtotalFormatted: string().required(),
      taxFormatted: string().required(),
      creditFormatted: string().required(),
      grandTotalFormatted: string().required(),
    }).required(),
  }).required(),
}).required();

export type WorkspaceBillingChangePreviewOutput = InferType<
  typeof WorkspaceBillingChangePreviewOutputSchema
>;

export const previewWorkspaceBillingChange = async ({
  workspaceSlug,
  prices,
}: WorkspaceBillingPricesInput): Promise<WorkspaceBillingChangePreviewOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/update-preview`, {
    validateSchema: WorkspaceBillingChangePreviewOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ prices }),
    },
  });

  return res as WorkspaceBillingChangePreviewOutput;
};

export const updateWorkspaceBilling = async ({
  workspaceSlug,
  prices,
}: WorkspaceBillingPricesInput): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/update`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ prices }),
    },
    skipJsonParse: true,
  });
};

export const cancelWorkspaceBilling = async (workspaceSlug: string): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/cancel`, {
    requestOptions: {
      method: "POST",
    },
    skipJsonParse: true,
  });
};

export const resumeWorkspaceBilling = async (workspaceSlug: string): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/resume`, {
    requestOptions: {
      method: "POST",
    },
    skipJsonParse: true,
  });
};
