import { InferType, number, object, string } from "yup";
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
      // Raw minor-unit credit alongside the formatted string so the dialog can
      // tell a real credit from a "0" and hide the row when there is none.
      credit: string().required(),
      creditFormatted: string().required(),
      grandTotalFormatted: string().required(),
    }).required(),
    // Projected effect of the change on the workspace's feeds. Optional so
    // self-hosted/billing-disabled responses (and older payloads) still
    // validate; the confirmation dialog only warns when present.
    feedImpact: object({
      newFeedLimit: number().required(),
      currentFeedCount: number().required(),
      willBeDisabledCount: number().required(),
    }).optional(),
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

const WorkspaceUpdatePaymentMethodOutputSchema = object({
  data: object({
    paddleTransactionId: string().required(),
  }).required(),
}).required();

export type WorkspaceUpdatePaymentMethodOutput = InferType<
  typeof WorkspaceUpdatePaymentMethodOutputSchema
>;

export const getWorkspaceUpdatePaymentMethodTransaction = async (
  workspaceSlug: string,
): Promise<WorkspaceUpdatePaymentMethodOutput> => {
  const res = await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/update-payment-method`, {
    validateSchema: WorkspaceUpdatePaymentMethodOutputSchema,
    requestOptions: {
      method: "POST",
    },
  });

  return res as WorkspaceUpdatePaymentMethodOutput;
};

export const convertWorkspaceBilling = async ({
  workspaceSlug,
  feedIds,
}: {
  workspaceSlug: string;
  feedIds: string[];
}): Promise<void> => {
  await fetchRest(`/api/v1/workspaces/${workspaceSlug}/billing/convert`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({ feedIds }),
    },
    skipJsonParse: true,
  });
};
